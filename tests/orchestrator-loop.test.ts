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
  git(["add", "."]);
  git(["commit", "-m", "init"]);
}

function renderOrchestratorRuntime(repoRoot: string, maxIterations = "2"): string {
  const runtimeDir = path.join(repoRoot, ".ai", "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
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
    .replaceAll("{{ orchestrator_max_review_iterations }}", maxIterations);
  const runtimePath = path.join(runtimeDir, "orchestrator-state.mjs");
  fs.writeFileSync(runtimePath, rendered, { mode: 0o755 });
  return runtimePath;
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

function submitIssue(runtimePath: string, repoRoot: string, issueId: string): void {
  runNodeScript(
    runtimePath,
    [
      "submit",
      "--issue",
      issueId,
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
  run.status = "testing";
  fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
  runNodeScript(
    runtimePath,
    ["record-test", "--issue", issueId, "--result", "pass", "--scope", "scoped"],
    repoRoot
  );
  runNodeScript(runtimePath, ["set-status", "--issue", issueId, "--status", "reviewing"], repoRoot);
}

describe("orchestrator loop guards", () => {
  test("record-review beyond max iterations sets awaiting-human-approval", () => {
    const repoRoot = makeTempRepo("aiforge-orch-limit-");
    initGitRepo(repoRoot);
    const runtimePath = renderOrchestratorRuntime(repoRoot, "2");
    runNodeScript(runtimePath, ["init"], repoRoot);
    submitIssue(runtimePath, repoRoot, "APP-9");

    prepareForReview(runtimePath, repoRoot, "APP-9");
    runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "high"], repoRoot);
    prepareForReview(runtimePath, repoRoot, "APP-9");
    runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "high"], repoRoot);
    prepareForReview(runtimePath, repoRoot, "APP-9");
    const blocked = JSON.parse(
      runNodeScript(runtimePath, ["record-review", "--issue", "APP-9", "--result", "high"], repoRoot)
    );

    expect(blocked.status).toBe("awaiting-human-approval");
    expect(blocked.reviewIteration).toBe(3);

    const graph = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "APP-9"], repoRoot));
    expect(graph.action).toBe("await_human_decision");

    const approved = JSON.parse(
      runNodeScript(runtimePath, ["approve-fix-loop", "--issue", "APP-9"], repoRoot)
    );
    expect(approved.status).toBe("fix-loop");
  });

  test("clean review moves to pre-finalize until full scoped test recorded", () => {
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
    expect(finalizeGraph.changeId).toBe("app-10");
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
            codex: { budget: "gpt-5.6-terra" }
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
    expect(hint.model).toBe("gpt-5.6-terra");
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
            codex: { budget: "gpt-5.6-terra" }
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
    expect(hint.model).toBe("gpt-5.6-terra");
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
    run.lastTestResult = "pass";
    run.lastTestScope = "scoped";
    fs.writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);

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
});
