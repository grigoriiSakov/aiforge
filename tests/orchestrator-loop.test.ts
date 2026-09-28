import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { spawnSync } from "node:child_process";

import { makeTempRepo } from "./helpers.js";

function initGitRepo(repoRoot: string): void {
  const git = (args: string[]) => {
    const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `git ${args.join(" ")}`);
    }
  };
  git(["init"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# test\n");
  fs.writeFileSync(
    path.join(repoRoot, ".gitignore"),
    ".ai/runtime/orchestrator/\n.ai/context/runtime/\n"
  );
  git(["add", "."]);
  git(["commit", "-m", "init"]);
}

function renderOrchestratorRuntime(repoRoot: string, maxIterations = "2", fullVerifyPolicy = "required"): string {
  const runtimeDir = path.join(repoRoot, ".ai", "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(
    path.join(
      process.cwd(),
      "template",
      "base",
      ".ai",
      "runtime",
      "workspace-fingerprint.mjs.jinja"
    ),
    path.join(runtimeDir, "workspace-fingerprint.mjs")
  );
  const templatePath = path.join(
    process.cwd(),
    "template",
    "base",
    ".ai",
    "runtime",
    "orchestrator-state.mjs.jinja"
  );
  const rendered = fs
    .readFileSync(templatePath, "utf8")
    .replaceAll("{{ orchestrator_worktree_root }}", path.join(repoRoot, "worktrees"))
    .replaceAll("{{ orchestrator_branch_prefix }}", "agent/")
    .replaceAll("{{ orchestrator_max_review_iterations }}", maxIterations)
    .replaceAll("{{ orchestrator_full_verify_policy }}", fullVerifyPolicy);
  const runtimePath = path.join(runtimeDir, "orchestrator-state.mjs");
  fs.writeFileSync(runtimePath, rendered, { mode: 0o755 });
  return runtimePath;
}

function createOpenSpecChange(repoRoot: string, changeId: string): void {
  const changeRoot = path.join(repoRoot, "openspec", "changes", changeId);
  fs.mkdirSync(path.join(changeRoot, "specs", "example"), { recursive: true });
  fs.writeFileSync(path.join(changeRoot, "proposal.md"), "# Proposal\n");
  fs.writeFileSync(path.join(changeRoot, "design.md"), "# Design\n");
  fs.writeFileSync(path.join(changeRoot, "tasks.md"), "- [x] 1.1 Implement the change\n");
  fs.writeFileSync(
    path.join(changeRoot, "specs", "example", "spec.md"),
    "## ADDED Requirements\n\n### Requirement: Example\nThe system SHALL work.\n"
  );
}

function isolatedAgentEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env, ...overrides };
  for (const marker of [
    "AIFORGE_ACTIVE_RUNTIME",
    "AIFORGE_RUNTIME_PROVIDER",
    "CODEX_THREAD_ID",
    "CODEX_CI",
    "CODEX_SANDBOX",
    "CODEX_ENV",
    "CODEX_ROOT",
    "CURSOR_TRACE_ID",
    "CURSOR_AGENT",
    "CURSOR_SESSION_ID",
    "CLAUDECODE",
    "CLAUDE_CODE"
  ]) {
    delete env[marker];
  }
  return { ...env, ...overrides };
}

function runNodeScript(
  runtimePath: string,
  args: string[],
  cwd: string,
  envOverrides: Record<string, string> = {}
): string {
  const result = spawnSync("node", [runtimePath, ...args], {
    cwd,
    encoding: "utf8",
    env: isolatedAgentEnv(envOverrides)
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `orchestrator failed: ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

function submitIssue(
  runtimePath: string,
  repoRoot: string,
  issueId: string,
  changeId = `${issueId.toLowerCase()}-change`
): void {
  createOpenSpecChange(repoRoot, changeId);
  runNodeScript(
    runtimePath,
    [
      "submit",
      "--issue",
      issueId,
      "--change-id",
      changeId,
      "--scope-json",
      JSON.stringify({
        areas: ["api"],
        paths: ["src/handler.ts"],
        shared_surfaces: [],
        related_issues: [],
        touches_process_layer: false
      })
    ],
    repoRoot
  );
}

function prepareForReview(runtimePath: string, repoRoot: string, issueId: string): void {
  const runPath = path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", `${issueId}.json`);
  const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
  run.worktreePath = repoRoot;
  run.status = "building";
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
  runNodeScript(
    runtimePath,
    ["record-test", "--issue", issueId, "--result", "pass", "--scope", "scoped"],
    repoRoot
  );
  runNodeScript(
    runtimePath,
    ["record-lint", "--issue", issueId, "--result", "pass", "--scope", "scoped"],
    repoRoot
  );
  runNodeScript(
    runtimePath,
    ["record-handoff", "--issue", issueId, "--note", "Scoped checks passed"],
    repoRoot
  );
  runNodeScript(runtimePath, ["set-status", "--issue", issueId, "--status", "reviewing"], repoRoot);
}

describe("orchestrator loop guards", () => {
  test("submission permits deferred OpenSpec binding and persists an explicit existing change id", () => {
    const repoRoot = makeTempRepo("aiforge-orch-change-binding-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "1");
    runNodeScript(runtimePath, ["init"], repoRoot);

    const missing = spawnSync(
      "node",
      [
        runtimePath,
        "submit",
        "--issue",
        "APP-7",
        "--scope-json",
        JSON.stringify({ paths: ["src/handler.ts"] })
      ],
      { cwd: repoRoot, encoding: "utf8", env: isolatedAgentEnv() }
    );
    expect(missing.status).toBe(0);
    const unboundRun = JSON.parse(missing.stdout);
    expect(unboundRun.changeId).toBeNull();
    expect(unboundRun.currentStep).toBe("awaiting-worktree-before-openspec");

    createOpenSpecChange(repoRoot, "browser-tenant-repair");
    const run = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "submit",
          "--issue",
          "APP-7",
          "--change-id",
          "browser-tenant-repair",
          "--scope-json",
          JSON.stringify({ paths: ["src/handler.ts"] })
        ],
        repoRoot
      )
    );
    expect(run.changeId).toBe("browser-tenant-repair");
  });

  test("handoff uses scoped checks without a progress file", () => {
    const repoRoot = makeTempRepo("aiforge-orch-progress-contract-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "1");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-7B");

    const runPath = path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-7B.json");
    const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
    run.worktreePath = repoRoot;
    run.status = "building";
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
    runNodeScript(
      runtimePath,
      ["record-test", "--issue", "APP-7B", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      ["record-lint", "--issue", "APP-7B", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );

    const handoff = spawnSync(
      "node",
      [runtimePath, "record-handoff", "--issue", "APP-7B", "--note", "Scoped checks passed"],
      { cwd: repoRoot, encoding: "utf8", env: isolatedAgentEnv() }
    );
    expect(handoff.status).toBe(0);
    expect(JSON.parse(handoff.stdout).handoffNote).toBe("Scoped checks passed");
  });

  test("implementation cannot move to review without fingerprinted handoff evidence", () => {
    const repoRoot = makeTempRepo("aiforge-orch-review-first-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "1");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-8");

    const runPath = path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-8.json");
    const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
    run.worktreePath = repoRoot;
    run.status = "building";
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

    const result = spawnSync(
      "node",
      [runtimePath, "set-status", "--issue", "APP-8", "--status", "reviewing"],
      { cwd: repoRoot, encoding: "utf8", env: isolatedAgentEnv() }
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("scoped test evidence");
  });

  test("initial plus one closure review is the hard automatic cap", () => {
    const repoRoot = makeTempRepo("aiforge-orch-limit-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "2");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-9");

    prepareForReview(runtimePath, repoRoot, "APP-9");
    runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "high"], repoRoot);
    runNodeScript(
      runtimePath,
      ["record-test", "--issue", "APP-9", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      ["record-lint", "--issue", "APP-9", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      ["record-fix-resolution", "--issue", "APP-9", "--decision", "require-rereview"],
      repoRoot
    );
    const closureGraph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-9"], repoRoot));
    expect(closureGraph.reviewMode).toBe("delta-only-closure");
    const blocked = JSON.parse(
      runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "high"], repoRoot)
    );

    expect(blocked.status).toBe("awaiting-human-approval");
    expect(blocked.reviewIteration).toBe(2);

    const graph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-9"], repoRoot));
    expect(graph.action).toBe("await_human_decision");

    const approved = JSON.parse(
      runNodeScript(runtimePath, ["approve-fix-loop", "--issue", "APP-9"], repoRoot)
    );
    expect(approved.status).toBe("fix-loop");
  });

  test("on-request policy finalizes from scoped evidence and runs full only after explicit request", () => {
    const repoRoot = makeTempRepo("aiforge-orch-on-request-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "2", "on-request");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-9");
    prepareForReview(runtimePath, repoRoot, "APP-9");

    const afterReview = JSON.parse(
      runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "clean"], repoRoot)
    );
    expect(afterReview.status).toBe("awaiting-finalize");
    const graph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-9"], repoRoot));
    expect(graph.action).toBe("finalize_openspec");

    const afterRequest = JSON.parse(
      runNodeScript(runtimePath, ["request-full-verify", "--issue", "APP-9"], repoRoot)
    );
    expect(afterRequest.status).toBe("pre-finalize");
    const fullGraph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-9"], repoRoot));
    expect(fullGraph.action).toBe("run_full_verify");
    const afterFull = JSON.parse(
      runNodeScript(runtimePath, ["record-test", "--issue", "APP-9", "--result", "pass", "--scope", "full"], repoRoot)
    );
    expect(afterFull.status).toBe("awaiting-finalize");
  });

  test("clean review reuses unchanged handoff evidence before full verification", () => {
    const repoRoot = makeTempRepo("aiforge-orch-prefinalize-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "2");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-10");

    prepareForReview(runtimePath, repoRoot, "APP-10");

    const afterReview = JSON.parse(
      runNodeScript(runtimePath, ["record-review", "--issue", "APP-10", "--result", "clean"], repoRoot)
    );
    expect(afterReview.status).toBe("pre-finalize");

    const graph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-10"], repoRoot));
    expect(graph.action).toBe("run_full_verify");
    expect(graph.testScope).toBe("full");

    const afterFull = JSON.parse(
      runNodeScript(
        runtimePath,
        ["record-test", "--issue", "APP-10", "--result", "pass", "--scope", "full"],
        repoRoot
      )
    );
    expect(afterFull.status).toBe("awaiting-finalize");

    const finalizeGraph = JSON.parse(
      runNodeScript(runtimePath, ["graph", "next", "APP-10"], repoRoot)
    );
    expect(finalizeGraph.action).toBe("finalize_openspec");
    expect(finalizeGraph.changeId).toBe("app-10-change");
  });

  test("terminal release requires the exact bound OpenSpec change to be archived", () => {
    const repoRoot = makeTempRepo("aiforge-orch-terminal-change-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "1");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-10B", "browser-context-repair");
    prepareForReview(runtimePath, repoRoot, "APP-10B");
    runNodeScript(runtimePath, ["record-review", "--issue", "APP-10B", "--result", "clean"], repoRoot);
    runNodeScript(
      runtimePath,
      ["record-test", "--issue", "APP-10B", "--result", "pass", "--scope", "full"],
      repoRoot
    );

    const premature = spawnSync(
      "node",
      [runtimePath, "release", "--issue", "APP-10B", "--status", "done"],
      { cwd: repoRoot, encoding: "utf8", env: isolatedAgentEnv() }
    );
    expect(premature.status).toBe(2);
    expect(premature.stderr).toContain("still active");

    const activeChange = path.join(repoRoot, "openspec", "changes", "browser-context-repair");
    const suffixCollision = path.join(
      repoRoot,
      "openspec",
      "changes",
      "archive",
      "2026-08-30-other-browser-context-repair"
    );
    fs.mkdirSync(suffixCollision, { recursive: true });
    fs.rmSync(activeChange, { recursive: true });
    const collisionOnly = spawnSync(
      "node",
      [runtimePath, "release", "--issue", "APP-10B", "--status", "done"],
      { cwd: repoRoot, encoding: "utf8", env: isolatedAgentEnv() }
    );
    expect(collisionOnly.status).toBe(2);
    expect(collisionOnly.stderr).toContain("archived OpenSpec change not found");

    const archivedChange = path.join(
      repoRoot,
      "openspec",
      "changes",
      "archive",
      "2026-08-31-browser-context-repair"
    );
    fs.mkdirSync(path.dirname(archivedChange), { recursive: true });
    fs.mkdirSync(archivedChange, { recursive: true });
    const released = JSON.parse(
      runNodeScript(runtimePath, ["release", "--issue", "APP-10B", "--status", "done"], repoRoot)
    );
    expect(released.released).toBe("APP-10B");
    expect(JSON.parse(runNodeScript(runtimePath, ["status", "--issue", "APP-10B"], repoRoot)).status).toBe("done");
  });

  test("Codex Goal thread markers select only the Codex model namespace", () => {
    const repoRoot = makeTempRepo("aiforge-orch-model-codex-");
    fs.mkdirSync(path.join(repoRoot, ".ai"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.model-profiles.json"),
      `${JSON.stringify(
        {
          roles: { review: { tier: "budget" } },
          runtimeModels: {
            cursor: { budget: "gpt-5-mini" },
            codex: { budget: "gpt-5.6-luna" }
          }
        },
        null,
        2
      )}\n`
    );
    const runtimePath = renderOrchestratorRuntime(repoRoot);

    const runtime = JSON.parse(
      runNodeScript(runtimePath, ["active-runtime"], repoRoot, {
        CODEX_THREAD_ID: "thread-123",
        CURSOR_AGENT: "1"
      })
    );
    const hint = JSON.parse(
      runNodeScript(runtimePath, ["model-hint", "--role", "review"], repoRoot, {
        CODEX_THREAD_ID: "thread-123",
        CURSOR_AGENT: "1"
      })
    );

    expect(runtime.detected).toBe("codex");
    expect(hint.activeRuntime).toBe("codex");
    expect(hint.model).toBe("gpt-5.6-luna");
    expect(hint.instruction).toContain("native subagent");
    expect(hint.instruction).toContain("Never run codex exec");
    expect(hint.instruction).not.toContain("codex -m");
  });

  test("model-hint ignores --runtime cursor when codex is active", () => {
    const repoRoot = makeTempRepo("aiforge-orch-model-mismatch-");
    fs.mkdirSync(path.join(repoRoot, ".ai"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.model-profiles.json"),
      `${JSON.stringify(
        {
          roles: { review: { tier: "budget" } },
          runtimeModels: {
            cursor: { budget: "gpt-5-mini" },
            codex: { budget: "gpt-5.6-luna" }
          }
        },
        null,
        2
      )}\n`
    );
    const runtimePath = renderOrchestratorRuntime(repoRoot);
    const hint = JSON.parse(
      runNodeScript(
        runtimePath,
        ["model-hint", "--role", "review", "--runtime", "cursor"],
        repoRoot,
        { CODEX_CI: "1" }
      )
    );
    expect(hint.activeRuntime).toBe("codex");
    expect(hint.model).toBe("gpt-5.6-luna");
    expect(hint.warnings.length).toBeGreaterThan(0);
  });

  test("record-fix-resolution skip-rereview moves to pre-finalize without new review iteration", () => {
    const repoRoot = makeTempRepo("aiforge-orch-skip-rereview-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "2");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-11");

    const runPath = path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-11.json");
    const run = JSON.parse(fs.readFileSync(runPath, "utf8"));
    run.worktreePath = repoRoot;
    run.status = "fix-loop";
    run.lastReviewResult = "medium";
    run.reviewIteration = 1;
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

    runNodeScript(
      runtimePath,
      ["record-test", "--issue", "APP-11", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      ["record-lint", "--issue", "APP-11", "--result", "pass", "--scope", "scoped"],
      repoRoot
    );

    const graph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-11"], repoRoot));
    expect(graph.action).toBe("decide_fix_loop");

    const resolved = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "record-fix-resolution",
          "--issue",
          "APP-11",
          "--decision",
          "skip-rereview",
          "--note",
          "all findings addressed"
        ],
        repoRoot
      )
    );
    expect(resolved.status).toBe("pre-finalize");
    expect(resolved.reviewIteration).toBe(1);
    expect(resolved.lastFixResolution?.decision).toBe("skip-rereview");
  });

  test("full verify failure allows one exact rerun and one final full retry", () => {
    const repoRoot = makeTempRepo("aiforge-orch-full-triage-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "1");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-12");
    prepareForReview(runtimePath, repoRoot, "APP-12");
    runNodeScript(runtimePath, ["record-review", "--issue", "APP-12", "--result", "clean"], repoRoot);

    const triage = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "record-test",
          "--issue",
          "APP-12",
          "--result",
          "fail",
          "--scope",
          "full",
          "--exact-target",
          "tests/flaky.test.ts"
        ],
        repoRoot
      )
    );
    expect(triage.status).toBe("full-failure-triage");
    const exactGraph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-12"], repoRoot));
    expect(exactGraph.action).toBe("run_exact_failure_rerun");

    const retryReady = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "record-test",
          "--issue",
          "APP-12",
          "--result",
          "pass",
          "--scope",
          "exact",
          "--target",
          "tests/flaky.test.ts"
        ],
        repoRoot
      )
    );
    expect(retryReady.status).toBe("pre-finalize");
    const retryGraph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-12"], repoRoot));
    expect(retryGraph.finalRetry).toBe(true);

    const bounded = JSON.parse(
      runNodeScript(
        runtimePath,
        ["record-test", "--issue", "APP-12", "--result", "fail", "--scope", "full"],
        repoRoot
      )
    );
    expect(bounded.status).toBe("awaiting-human-approval");
    expect(bounded.fullVerifyAttempts).toBe(2);
  });

  test("model-hint skips auto and returns usable slug", () => {
    const repoRoot = makeTempRepo("aiforge-orch-model-");
    fs.mkdirSync(path.join(repoRoot, ".ai"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.model-profiles.json"),
      `${JSON.stringify(
        {
          roles: { review: { tier: "budget" } },
          runtimeModels: {
            cursor: { budget: "gpt-5-mini", balanced: "auto" }
          }
        },
        null,
        2
      )}\n`
    );
    const runtimePath = renderOrchestratorRuntime(repoRoot);

    const budget = JSON.parse(
      runNodeScript(runtimePath, ["model-hint", "--role", "review", "--runtime", "cursor"], repoRoot)
    );
    expect(budget.model).toBe("gpt-5-mini");

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.model-profiles.json"),
      `${JSON.stringify(
        {
          roles: { review: { tier: "balanced" } },
          runtimeModels: { cursor: { balanced: "auto" } }
        },
        null,
        2
      )}\n`
    );
    const autoHint = JSON.parse(
      runNodeScript(runtimePath, ["model-hint", "--role", "review", "--runtime", "cursor"], repoRoot)
    );
    expect(autoHint.model).toBeNull();
    expect(autoHint.skipReason).toBe("reserved-ui-mode");
  });

  test("full review promotes a budget review role to the quality tier", () => {
    const repoRoot = makeTempRepo("aiforge-orch-full-review-model-");
    fs.mkdirSync(path.join(repoRoot, ".ai"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.model-profiles.json"),
      `${JSON.stringify(
        {
          roles: { review: { tier: "budget" } },
          runtimeModels: {
            codex: { budget: "gpt-5.6-luna", quality: "gpt-5.6-sol" }
          }
        },
        null,
        2
      )}\n`
    );
    const runtimePath = renderOrchestratorRuntime(repoRoot);

    const hint = JSON.parse(
      runNodeScript(
        runtimePath,
        ["model-hint", "--role", "review", "--review-depth", "full"],
        repoRoot,
        { CODEX_CI: "1" }
      )
    );
    expect(hint.configuredTier).toBe("budget");
    expect(hint.tier).toBe("quality");
    expect(hint.model).toBe("gpt-5.6-sol");
    expect(hint.promotionReason).toContain("full review");
  });
});
