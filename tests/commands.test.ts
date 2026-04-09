import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { beforeEach, describe, expect, test } from "vitest";

import { runAdoptCommand } from "../src/commands/adopt.js";
import { runDoctorCommand } from "../src/commands/doctor.js";
import { runInitCommand } from "../src/commands/init.js";
import {
  runInitiativeSupervisorAbortCommand,
  runInitiativeSupervisorInitCommand,
  runInitiativeSupervisorNextCommand,
  runInitiativeSupervisorPauseCommand,
  runInitiativeSupervisorResumeCommand,
  runInitiativeSupervisorStartCommand,
  runInitiativeSupervisorStatusCommand
} from "../src/commands/initiative-supervisor.js";
import { runLinearInitCommand } from "../src/commands/linear-init.js";
import { runLinearScopeSetCommand } from "../src/commands/linear-scope-set.js";
import { runLlmsBuildCommand } from "../src/commands/llms-build.js";
import { runManifestoInitCommand } from "../src/commands/manifesto-init.js";
import { runMcpScaffoldCommand } from "../src/commands/mcp-scaffold.js";
import { runProjectStubCommand } from "../src/commands/project-stub.js";
import { runSyncCommand } from "../src/commands/sync.js";
import { runUpdateCommand } from "../src/commands/update.js";
import { CONFIG_FILE_NAME, loadConfig, saveConfig } from "../src/core/config.js";
import {
  createFakeExecutable,
  copyFixture,
  createFakeCopierBin,
  installClaudeHookTemplates,
  installCodexHookTemplates,
  installCursorHookTemplates,
  installReviewRuntime,
  installStopGuard,
  makeTempRepo,
  runNodeScript,
  runNodeScriptWithInput
} from "./helpers.js";

describe("command flow", () => {
  const originalPath = process.env.PATH ?? "";

  beforeEach(() => {
    process.env.PATH = originalPath;
    process.env.AI_SIMPLE_COPIER_BIN = createFakeCopierBin();
    delete process.env.AI_SIMPLE_COPIER_USE_PYTHON;
  });

  test("init creates config and generated artifacts", async () => {
    const repoRoot = makeTempRepo("ai-simple-init-");
    const result = await runInitCommand({
      repoRoot,
      projectName: "Demo App",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, CONFIG_FILE_NAME))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "MANIFESTO.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "llms.txt"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "linear-scope.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "reference", "PROMPT_OPTIMIZATION_STRATEGY.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "reference", "orchestrator-claimed-scope-template.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".claude", "hooks.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "rules", "linear-mcp.mdc"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "skills", "plan", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "runtime", "orchestrator-state.mjs"))).toBe(true);
    const answersContent = fs.readFileSync(path.join(repoRoot, ".copier-answers.yml"), "utf8");
    expect(answersContent).toContain("_src_path:");
    expect(answersContent).not.toContain("_commit:");
    expect(answersContent).not.toContain("_subdirectory:");
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "commands"))).toBe(false);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "reference")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "context")).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "linear-scope.json"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"))).toBe(false);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".claude", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agents", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".codex", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "reference"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "reference"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "context"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "context"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".claude", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agent", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agents", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.readFileSync(path.join(repoRoot, ".ai", "skills", "plan", "SKILL.md"), "utf8")).toContain(
      "---\nname: plan\ndescription:"
    );
    expect(fs.lstatSync(path.join(repoRoot, ".codex", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".claude", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".claude", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agent", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("orchestrator runtime serializes related issues and direct conflicts", () => {
    const repoRoot = makeTempRepo("ai-simple-orchestrator-runtime-");
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
    const renderedRuntime = fs
      .readFileSync(templatePath, "utf8")
      .replaceAll("{{ orchestrator_worktree_root }}", path.join(repoRoot, "worktrees"))
      .replaceAll("{{ orchestrator_branch_prefix }}", "agent/")
      .replaceAll("{{ orchestrator_max_review_iterations }}", "3");
    const runtimePath = path.join(runtimeDir, "orchestrator-state.mjs");
    fs.writeFileSync(runtimePath, renderedRuntime, { mode: 0o755 });

    const registry = JSON.parse(runNodeScript(runtimePath, ["init"], repoRoot));
    expect(registry.activeReservations).toEqual({});

    const firstRun = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "submit",
          "--issue",
          "APP-1",
          "--scope-json",
          JSON.stringify({
            areas: ["api"],
            paths: ["src/api/handler.ts"],
            shared_surfaces: [],
            related_issues: [],
            touches_process_layer: false
          })
        ],
        repoRoot
      )
    );
    expect(firstRun.status).toBe("reserved");

    const relatedRun = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "submit",
          "--issue",
          "APP-2",
          "--scope-json",
          JSON.stringify({
            areas: ["worker"],
            paths: ["src/worker/job.ts"],
            shared_surfaces: [],
            related_issues: ["APP-1"],
            touches_process_layer: false
          })
        ],
        repoRoot
      )
    );
    expect(relatedRun.status).toBe("queued");

    const conflictingRun = JSON.parse(
      runNodeScript(
        runtimePath,
        [
          "submit",
          "--issue",
          "APP-3",
          "--scope-json",
          JSON.stringify({
            areas: ["api"],
            paths: ["src/api/handler.ts"],
            shared_surfaces: [],
            related_issues: [],
            touches_process_layer: false
          })
        ],
        repoRoot
      )
    );
    expect(conflictingRun.status).toBe("blocked-by-conflict");

    const releaseResult = JSON.parse(
      runNodeScript(runtimePath, ["release", "--issue", "APP-1", "--status", "done"], repoRoot)
    );
    expect(releaseResult.promoted).toContain("APP-2");

    const promotedRun = JSON.parse(runNodeScript(runtimePath, ["status", "--issue", "APP-2"], repoRoot));
    expect(promotedRun.status).toBe("reserved");
  });

  test("orchestrator start-worktree uses current branch as base unless --base-branch is set", () => {
    const repoRoot = makeTempRepo("ai-simple-orchestrator-worktree-base-");
    const git = (args: string[]) => {
      const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
      }
      return result.stdout.trim();
    };

    git(["init"]);
    git(["config", "user.email", "t@t.t"]);
    git(["config", "user.name", "t"]);
    fs.mkdirSync(path.join(repoRoot, "src", "api"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "src", "api", "handler.ts"), "// base\n");
    git(["add", "."]);
    git(["commit", "-m", "base"]);
    git(["branch", "-M", "main"]);
    git(["checkout", "-b", "feature/orch"]);
    fs.appendFileSync(path.join(repoRoot, "src", "api", "handler.ts"), "// more\n");
    git(["add", "."]);
    git(["commit", "-m", "feature"]);

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
    const renderedRuntime = fs
      .readFileSync(templatePath, "utf8")
      .replaceAll("{{ orchestrator_worktree_root }}", path.join(repoRoot, "worktrees"))
      .replaceAll("{{ orchestrator_branch_prefix }}", "agent/")
      .replaceAll("{{ orchestrator_max_review_iterations }}", "3");
    const runtimePath = path.join(runtimeDir, "orchestrator-state.mjs");
    fs.writeFileSync(runtimePath, renderedRuntime, { mode: 0o755 });

    runNodeScript(runtimePath, ["init"], repoRoot);
    runNodeScript(
      runtimePath,
      [
        "submit",
        "--issue",
        "WT-1",
        "--scope-json",
        JSON.stringify({
          areas: ["api"],
          paths: ["src/api/handler.ts"],
          shared_surfaces: [],
          related_issues: [],
          touches_process_layer: false
        })
      ],
      repoRoot
    );

    const started = JSON.parse(runNodeScript(runtimePath, ["start-worktree", "--issue", "WT-1"], repoRoot));
    const worktreePath = started.worktreePath as string;
    const mainCheckoutHead = git(["rev-parse", "HEAD"]);
    const worktreeHead = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: worktreePath,
      encoding: "utf8"
    }).stdout.trim();
    expect(worktreeHead).toBe(mainCheckoutHead);

    runNodeScript(runtimePath, ["release", "--issue", "WT-1", "--remove-worktree", "--status", "done"], repoRoot);

    runNodeScript(
      runtimePath,
      [
        "submit",
        "--issue",
        "WT-2",
        "--base-branch",
        "main",
        "--scope-json",
        JSON.stringify({
          areas: ["api"],
          paths: ["src/api/handler.ts"],
          shared_surfaces: [],
          related_issues: [],
          touches_process_layer: false
        })
      ],
      repoRoot
    );

    const started2 = JSON.parse(runNodeScript(runtimePath, ["start-worktree", "--issue", "WT-2"], repoRoot));
    const worktreePath2 = started2.worktreePath as string;
    const mainTip = git(["rev-parse", "main"]);
    const worktreeHead2 = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: worktreePath2,
      encoding: "utf8"
    }).stdout.trim();
    expect(worktreeHead2).toBe(mainTip);
    expect(worktreeHead2).not.toBe(git(["rev-parse", "HEAD"]));
  });

  test("initiative supervisor runtime persists issue order, rework loop, and completion", () => {
    const repoRoot = makeTempRepo("ai-simple-initiative-supervisor-");
    const runtimeDir = path.join(repoRoot, ".ai", "runtime");
    const initiativeDir = path.join(repoRoot, ".ai", "context", "initiatives", "billing-v2");
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.mkdirSync(initiativeDir, { recursive: true });

    fs.writeFileSync(
      path.join(initiativeDir, "issues-manifest.json"),
      JSON.stringify(
        {
          version: 1,
          slug: "billing-v2",
          baseBranch: "main",
          managerBranch: "initiative/billing-v2",
          maxAttemptsPerIssue: 3,
          artifacts: {
            prd: ".ai/context/initiatives/billing-v2/prd.md"
          },
          issues: [
            {
              id: "APP-1",
              title: "Backend contract",
              order: 10,
              blockedBy: []
            },
            {
              id: "APP-2",
              title: "Frontend adoption",
              order: 20,
              blockedBy: ["APP-1"]
            }
          ]
        },
        null,
        2
      ) + "\n"
    );

    const templatePath = path.join(
      process.cwd(),
      "template",
      "base",
      ".ai",
      "runtime",
      "initiative-supervisor-state.mjs.jinja"
    );
    const renderedRuntime = fs
      .readFileSync(templatePath, "utf8")
      .replaceAll("{{ main_branch }}", "main")
      .replaceAll("{{ plan_progress_runtime_root }}", ".ai/context/runtime")
      .replaceAll("{{ manifesto_path }}", "MANIFESTO.md");
    const runtimePath = path.join(runtimeDir, "initiative-supervisor-state.mjs");
    fs.writeFileSync(runtimePath, renderedRuntime, { mode: 0o755 });

    const initial = JSON.parse(runNodeScript(runtimePath, ["init", "--slug", "billing-v2"], repoRoot));
    expect(initial.managerBranch).toBe("initiative/billing-v2");

    const firstNext = JSON.parse(
      runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot)
    );
    expect(firstNext.action).toBe("launch_worker");
    expect(firstNext.issue).toBe("APP-1");
    expect(firstNext.attempt).toBe(1);

    const promptInfo = JSON.parse(
      runNodeScript(runtimePath, ["prepare-worker-prompt", "--slug", "billing-v2"], repoRoot)
    );
    expect(promptInfo.issue).toBe("APP-1");
    expect(fs.existsSync(path.join(repoRoot, String(promptInfo.promptPath)))).toBe(true);

    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--status",
        "launched",
        "--run-id",
        "w1",
        "--worktree-path",
        "/tmp/worktrees/APP-1"
      ],
      repoRoot
    );
    const waiting = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot));
    expect(waiting.action).toBe("wait_worker");

    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--status",
        "completed",
        "--run-id",
        "w1",
        "--worktree-path",
        "/tmp/worktrees/APP-1"
      ],
      repoRoot
    );
    const reviewStep = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot));
    expect(reviewStep.action).toBe("run_manager_review");
    expect(reviewStep.issue).toBe("APP-1");

    const findingsInfo = JSON.parse(
      runNodeScript(runtimePath, ["write-findings-stub", "--slug", "billing-v2", "--issue", "APP-1"], repoRoot)
    );
    expect(fs.existsSync(path.join(repoRoot, String(findingsInfo.findingsPath)))).toBe(true);

    runNodeScript(
      runtimePath,
      [
        "record-review",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--result",
        "rework",
        "--findings-path",
        String(findingsInfo.findingsPath)
      ],
      repoRoot
    );
    const relaunch = JSON.parse(runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot));
    expect(relaunch.action).toBe("launch_worker");
    expect(relaunch.issue).toBe("APP-1");
    expect(relaunch.attempt).toBe(2);
    expect(relaunch.findingsPath).toBe(findingsInfo.findingsPath);

    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--status",
        "launched",
        "--run-id",
        "w2",
        "--worktree-path",
        "/tmp/worktrees/APP-1"
      ],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--status",
        "completed",
        "--run-id",
        "w2",
        "--worktree-path",
        "/tmp/worktrees/APP-1"
      ],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      [
        "record-review",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--result",
        "accept",
        "--summary",
        "manager accepted"
      ],
      repoRoot
    );
    const finalizeFirst = JSON.parse(
      runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot)
    );
    expect(finalizeFirst.action).toBe("finalize_issue");

    runNodeScript(
      runtimePath,
      [
        "mark-issue-done",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-1",
        "--commit-sha",
        "abc123"
      ],
      repoRoot
    );
    const secondNext = JSON.parse(
      runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot)
    );
    expect(secondNext.action).toBe("launch_worker");
    expect(secondNext.issue).toBe("APP-2");

    runNodeScript(runtimePath, ["pause", "--slug", "billing-v2", "--reason", "manual"], repoRoot);
    const pausedNext = JSON.parse(
      runNodeScript(runtimePath, ["graph", "next", "--slug", "billing-v2"], repoRoot)
    );
    expect(pausedNext.action).toBe("wait_resume");

    runNodeScript(runtimePath, ["resume", "--slug", "billing-v2"], repoRoot);
    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-2",
        "--status",
        "launched",
        "--run-id",
        "w3",
        "--worktree-path",
        "/tmp/worktrees/APP-2"
      ],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      [
        "record-worker",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-2",
        "--status",
        "completed",
        "--run-id",
        "w3",
        "--worktree-path",
        "/tmp/worktrees/APP-2"
      ],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      [
        "record-review",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-2",
        "--result",
        "accept"
      ],
      repoRoot
    );
    runNodeScript(
      runtimePath,
      [
        "mark-issue-done",
        "--slug",
        "billing-v2",
        "--issue",
        "APP-2",
        "--commit-sha",
        "def456"
      ],
      repoRoot
    );

    const finished = JSON.parse(runNodeScript(runtimePath, ["status", "--slug", "billing-v2"], repoRoot));
    expect(finished.status).toBe("done");
    expect(finished.issues["APP-1"].commitSha).toBe("abc123");
    expect(finished.issues["APP-2"].commitSha).toBe("def456");
    expect(
      fs.existsSync(path.join(repoRoot, ".ai", "runtime", "initiative-supervisor", "current", "billing-v2.md"))
    ).toBe(true);
  });

  test("initiative supervisor command wrappers init, start, inspect, pause, resume, and abort existing initiatives", async () => {
    const repoRoot = makeTempRepo("ai-simple-initiative-supervisor-cli-");
    await runInitCommand({
      repoRoot,
      projectName: "Supervisor CLI Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const runtimeDir = path.join(repoRoot, ".ai", "runtime");
    const initiativeDir = path.join(repoRoot, ".ai", "context", "initiatives", "kernel");
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.mkdirSync(initiativeDir, { recursive: true });
    fs.writeFileSync(
      path.join(initiativeDir, "issues-manifest.json"),
      JSON.stringify(
        {
          version: 1,
          slug: "kernel",
          baseBranch: "main",
          managerBranch: "initiative/kernel",
          issues: [{ id: "APP-77", title: "Refactor kernel", order: 10, blockedBy: [] }]
        },
        null,
        2
      ) + "\n"
    );

    const runtimeTemplatePath = path.join(
      process.cwd(),
      "template",
      "base",
      ".ai",
      "runtime",
      "initiative-supervisor-state.mjs.jinja"
    );
    const renderedRuntime = fs
      .readFileSync(runtimeTemplatePath, "utf8")
      .replaceAll("{{ main_branch }}", "main")
      .replaceAll("{{ plan_progress_runtime_root }}", ".ai/context/runtime")
      .replaceAll("{{ manifesto_path }}", "MANIFESTO.md");
    fs.writeFileSync(path.join(runtimeDir, "initiative-supervisor-state.mjs"), renderedRuntime, { mode: 0o755 });

    expect(() => runInitiativeSupervisorStartCommand(repoRoot, { slug: "kernel" })).toThrow(
      /Run `aiforge initiative-supervisor init --slug kernel` first/
    );

    const initialized = runInitiativeSupervisorInitCommand(repoRoot, {
      slug: "kernel",
      project: "Kernel",
      projectId: "project-123",
      tracker: "linear",
      managerBranch: "initiative/kernel"
    });
    expect(initialized.ok).toBe(true);
    expect(initialized.message).toContain("initialized");
    expect(
      ((initialized.details as Record<string, unknown>).manifestProject as Record<string, unknown>).project
    ).toBe("Kernel");
    expect(
      ((initialized.details as Record<string, unknown>).state as Record<string, unknown>).status
    ).toBe("paused");

    const status = runInitiativeSupervisorStatusCommand(repoRoot, "kernel");
    expect(status.ok).toBe(true);
    expect((status.details as Record<string, unknown>).status).toBe("paused");

    const started = runInitiativeSupervisorStartCommand(repoRoot, { slug: "kernel" });
    expect(started.ok).toBe(true);
    expect(started.message).toContain("started");
    expect((started.details as Record<string, unknown>).status).toBe("running");

    const next = runInitiativeSupervisorNextCommand(repoRoot, "kernel");
    expect((next.details as Record<string, unknown>).action).toBe("launch_worker");

    const paused = runInitiativeSupervisorPauseCommand(repoRoot, { slug: "kernel", reason: "waiting" });
    expect((paused.details as Record<string, unknown>).status).toBe("paused");

    const resumedViaStart = runInitiativeSupervisorStartCommand(repoRoot, { slug: "kernel" });
    expect(resumedViaStart.message).toContain("started");
    expect((resumedViaStart.details as Record<string, unknown>).status).toBe("running");

    const resumed = runInitiativeSupervisorResumeCommand(repoRoot, "kernel");
    expect((resumed.details as Record<string, unknown>).status).toBe("running");

    const aborted = runInitiativeSupervisorAbortCommand(repoRoot, { slug: "kernel", reason: "stop now" });
    expect((aborted.details as Record<string, unknown>).status).toBe("aborted");
  });

  test("codex guards block manager-mode edits when initiative supervisor is active", async () => {
    const repoRoot = makeTempRepo("ai-simple-supervisor-guard-");
    const git = (args: string[]) => {
      const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
      }
      return result.stdout.trim();
    };

    git(["init"]);
    git(["config", "user.email", "t@t.t"]);
    git(["config", "user.name", "t"]);
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# demo\n");
    git(["add", "."]);
    git(["commit", "-m", "base"]);
    git(["branch", "-M", "main"]);
    git(["checkout", "-b", "initiative/demo"]);

    await runInitCommand({
      repoRoot,
      projectName: "Supervisor Guard Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installCodexHookTemplates(repoRoot);
    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "initiative-supervisor", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "initiative-supervisor", "runs", "demo.json"),
      JSON.stringify(
        {
          slug: "demo",
          status: "running",
          managerBranch: "initiative/demo",
          currentIssueId: "APP-1",
          issues: {
            "APP-1": {
              status: "worker-completed"
            }
          }
        },
        null,
        2
      ) + "\n"
    );

    const preToolUseGuardPath = path.join(repoRoot, ".codex", "hooks", "pre-tool-use-guard.mjs");
    const stopGuardPath = path.join(repoRoot, ".codex", "hooks", "stop-delivery-guard.mjs");
    const postToolUseGuardPath = path.join(repoRoot, ".codex", "hooks", "post-tool-use-guard.mjs");

    const deniedEdit = JSON.parse(
      runNodeScriptWithInput(
        preToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_name: "Edit", tool_input: { path: "src/app.ts" } })
      ).stdout
    );
    expect(deniedEdit.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(deniedEdit.systemMessage).toContain("Manager mode");

    const allowedRuntimeEdit = JSON.parse(
      runNodeScriptWithInput(
        preToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({
          tool_name: "Edit",
          tool_input: { path: ".ai/runtime/initiative-supervisor/findings/demo/APP-1-attempt-1.md" }
        })
      ).stdout
    );
    expect(allowedRuntimeEdit.continue).toBe(true);

    const postToolUse = JSON.parse(
      runNodeScriptWithInput(
        postToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_input: { command: "git status" } })
      ).stdout
    );
    expect(postToolUse.systemMessage).toContain("Initiative supervisor demo is still active");
    expect(postToolUse.systemMessage).toContain("run_manager_review");

    const stopGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(stopGuard.stopReason).toBe("initiative_supervisor_incomplete");
    expect(stopGuard.systemMessage).toContain("run_manager_review");
  });

  test("claude hooks block manager-mode edits when initiative supervisor is active", async () => {
    const repoRoot = makeTempRepo("ai-simple-claude-guard-");
    const git = (args: string[]) => {
      const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
      }
      return result.stdout.trim();
    };

    git(["init"]);
    git(["config", "user.email", "t@t.t"]);
    git(["config", "user.name", "t"]);
    fs.writeFileSync(path.join(repoRoot, "README.md"), "# demo\n");
    git(["add", "."]);
    git(["commit", "-m", "base"]);
    git(["branch", "-M", "main"]);
    git(["checkout", "-b", "initiative/demo"]);

    await runInitCommand({
      repoRoot,
      projectName: "Claude Guard Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installClaudeHookTemplates(repoRoot);
    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "initiative-supervisor", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "initiative-supervisor", "runs", "demo.json"),
      JSON.stringify(
        {
          slug: "demo",
          status: "running",
          managerBranch: "initiative/demo",
          currentIssueId: "APP-1",
          issues: {
            "APP-1": {
              status: "worker-completed"
            }
          }
        },
        null,
        2
      ) + "\n"
    );

    const preToolUseGuardPath = path.join(repoRoot, ".claude", "hooks", "pre-tool-use-guard.mjs");
    const stopGuardPath = path.join(repoRoot, ".claude", "hooks", "stop-delivery-guard.mjs");

    const deniedEdit = JSON.parse(
      runNodeScriptWithInput(
        preToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_name: "Edit", tool_input: { path: "src/app.ts" } })
      ).stdout
    );
    expect(deniedEdit.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(deniedEdit.systemMessage).toContain("Manager mode");

    const stopGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(stopGuard.stopReason).toBe("initiative_supervisor_incomplete");
    expect(stopGuard.systemMessage).toContain("Initiative supervisor demo");
  });

  test("dry-run init does not write config", async () => {
    const repoRoot = makeTempRepo("ai-simple-dry-init-");
    const result = await runInitCommand({
      repoRoot,
      projectName: "Dry Demo",
      profileId: "python-fastapi-docker",
      dryRun: true
    });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, CONFIG_FILE_NAME))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "project.manifest.json"))).toBe(false);
  });

  test("adopt uses detected profile and keeps repo healthy", async () => {
    const repoRoot = copyFixture("laravel-docker");
    const result = await runAdoptCommand({ repoRoot, dryRun: false });

    expect(result.ok).toBe(true);
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("detect requires explicit profile for empty repo", async () => {
    const repoRoot = makeTempRepo("ai-simple-empty-");
    await expect(runAdoptCommand({ repoRoot, dryRun: false })).rejects.toThrow(
      /Pass --profile explicitly/
    );
  });

  test("sync regenerates manifesto and llms", async () => {
    const repoRoot = copyFixture("vue-quasar-capacitor");
    await runAdoptCommand({ repoRoot, dryRun: false });

    fs.rmSync(path.join(repoRoot, "MANIFESTO.md"));
    fs.rmSync(path.join(repoRoot, "llms.txt"));
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify({ stale: true }, null, 2) + "\n"
    );

    const result = await runSyncCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "MANIFESTO.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "llms.txt"))).toBe(true);
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("sync backfills machine manifest for older projects without rewriting ai.config.yaml", async () => {
    const repoRoot = makeTempRepo("ai-simple-config-backfill-");
    await runInitCommand({
      repoRoot,
      projectName: "Backfill Demo",
      profileId: "laravel-docker",
      dryRun: false
    });

    const legacyConfig = loadConfig(repoRoot);
    delete legacyConfig.projectRules;
    delete legacyConfig.agents;
    delete legacyConfig.manifesto.markdown;
    legacyConfig.managedSurfaces = legacyConfig.managedSurfaces.filter((entry) => entry.path !== ".ai");
    const legacyConfigYaml = [
      "schemaVersion: 1",
      "project:",
      `  slug: ${legacyConfig.project.slug}`,
      `  name: ${legacyConfig.project.name}`,
      `  mainBranch: ${legacyConfig.project.mainBranch}`,
      "workflow:",
      `  tracker: ${legacyConfig.workflow.tracker}`,
      "  phases:",
      ...legacyConfig.workflow.phases.map((phase) => `    - ${phase}`),
      `  language: ${legacyConfig.workflow.language}`,
      "  trackerStates:",
      `    planReady: ${legacyConfig.workflow.trackerStates.planReady}`,
      `    active: ${legacyConfig.workflow.trackerStates.active}`,
      `    review: ${legacyConfig.workflow.trackerStates.review}`,
      "linear:",
      `  enabled: ${legacyConfig.linear.enabled}`,
      `  requireTrackerForIssueFlow: ${legacyConfig.linear.requireTrackerForIssueFlow}`,
      "  scopes: []",
      "profile:",
      `  id: ${legacyConfig.profile.id}`,
      "orchestrator:",
      `  worktreeRoot: ${legacyConfig.orchestrator.worktreeRoot}`,
      `  branchPrefix: "${legacyConfig.orchestrator.branchPrefix}"`,
      `  maxReviewIterations: ${legacyConfig.orchestrator.maxReviewIterations}`,
      "runtimes:",
      `  cursor: ${legacyConfig.runtimes.cursor}`,
      `  codex: ${legacyConfig.runtimes.codex}`,
      `  claude: ${legacyConfig.runtimes.claude}`,
      `  agent: ${legacyConfig.runtimes.agent}`,
      `  agents: ${legacyConfig.runtimes.agents}`,
      "task:",
      `  command: ${legacyConfig.task.command}`,
      "  tasks:",
      `    build: ${legacyConfig.task.tasks.build}`,
      `    test: ${legacyConfig.task.tasks.test}`,
      `    lint: ${legacyConfig.task.tasks.lint}`,
      `    verify: ${legacyConfig.task.tasks.verify}`,
      `    review: ${legacyConfig.task.tasks.review}`,
      "commands:",
      "  build: []",
      "  test: []",
      "  lint: []",
      "  verify: []",
      "  review: []",
      "manifesto:",
      `  path: ${legacyConfig.manifesto.path}`,
      `  title: ${legacyConfig.manifesto.title}`,
      "llms:",
      `  rootDir: ${legacyConfig.llms.rootDir}`,
      `  txtPath: ${legacyConfig.llms.txtPath}`,
      "  sourceGlobs: []",
      "mcp:",
      `  scaffold: ${legacyConfig.mcp.scaffold}`,
      "  placeholders: []",
      "managedSurfaces:",
      ...legacyConfig.managedSurfaces.map((entry) => `  - path: ${entry.path}\n    policy: ${entry.policy}`),
      `updatePolicy: ${legacyConfig.updatePolicy}`,
      "features:",
      `  mcp: ${legacyConfig.features.mcp}`,
      `  llms: ${legacyConfig.features.llms}`,
      `  manifesto: ${legacyConfig.features.manifesto}`,
      ""
    ].join("\n");
    fs.writeFileSync(path.join(repoRoot, CONFIG_FILE_NAME), legacyConfigYaml);

    const rawLegacyConfig = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    expect(rawLegacyConfig).not.toContain("\nprojectRules:\n");
    expect(rawLegacyConfig).not.toContain("\nagents:\n  markdown:");
    expect(rawLegacyConfig).not.toContain("\n  markdown: \"\"");
    expect(rawLegacyConfig).not.toContain("- path: .ai");

    const result = await runSyncCommand(repoRoot, false);
    expect(result.ok).toBe(true);

    const syncedConfig = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    expect(syncedConfig).toBe(rawLegacyConfig);

    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, ".ai", "project.manifest.json"), "utf8"));
    expect(manifest.projectRules).toEqual({ markdown: "" });
    expect(manifest.agents).toEqual({ markdown: "" });
    expect(manifest.manifesto.markdown).toBe("");
    expect(manifest.managedSurfaces.some((entry: { path: string }) => entry.path === ".ai")).toBe(true);
    expect(manifest.workflow.trackerStates).toBeTruthy();
    expect(manifest.orchestrator).toBeTruthy();
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("sync and update preserve durable ai.config.yaml without profile override", async () => {
    const repoRoot = makeTempRepo("ai-simple-preserve-config-");
    await runInitCommand({
      repoRoot,
      projectName: "Preserve Config Demo",
      profileId: "laravel-docker",
      dryRun: false
    });

    const config = loadConfig(repoRoot);
    config.commands.test = ["bash scripts/task-test.sh"];
    config.commands.lint = ["bash scripts/task-lint.sh"];
    config.projectRules = {
      markdown: [
        "## Orchestrator external worktree execution",
        "- Use `AIFORGE_WORKTREE_PATH` for orchestrator-owned task execution.",
        "- Canonical tasks choose exec vs compose run automatically."
      ].join("\n")
    };
    saveConfig(repoRoot, config);

    const configBeforeSync = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    const syncResult = await runSyncCommand(repoRoot, false);
    expect(syncResult.ok).toBe(true);
    expect(syncResult.details?.configWritten).toBe(false);
    expect(fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8")).toBe(configBeforeSync);

    fs.writeFileSync(path.join(repoRoot, ".ai", "project.manifest.json"), JSON.stringify({ stale: true }, null, 2) + "\n");

    const configBeforeUpdate = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    const updateResult = await runUpdateCommand(repoRoot, false);
    expect(updateResult.ok).toBe(true);
    expect(updateResult.details?.configWritten).toBe(false);
    expect(fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8")).toBe(configBeforeUpdate);

    const projectProfilePath = path.join(repoRoot, ".ai", "rules", "project-profile.mdc");
    const projectProfile = fs.readFileSync(projectProfilePath, "utf8");
    expect(projectProfile).toContain("## Orchestrator external worktree execution");
    expect(projectProfile).toContain("AIFORGE_WORKTREE_PATH");
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("sync rewrites ai.config.yaml only when profile override is requested", async () => {
    const repoRoot = makeTempRepo("ai-simple-sync-profile-override-");
    await runInitCommand({
      repoRoot,
      projectName: "Profile Override Demo",
      profileId: "laravel-docker",
      dryRun: false
    });

    const configBefore = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    const result = await runSyncCommand(repoRoot, false, "vue-quasar-capacitor");
    expect(result.ok).toBe(true);
    expect(result.details?.configWritten).toBe(true);

    const configAfter = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    expect(configAfter).not.toBe(configBefore);

    const syncedConfig = loadConfig(repoRoot);
    expect(syncedConfig.profile.id).toBe("vue-quasar-capacitor");
    expect(syncedConfig.commands.build).toEqual(["yarn build"]);
  });

  test("sync and update regenerate project profile from config markdown", async () => {
    const repoRoot = makeTempRepo("ai-simple-project-rules-");
    await runInitCommand({
      repoRoot,
      projectName: "Project Rules Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const config = loadConfig(repoRoot);
    config.projectRules = {
      markdown: [
        "## Architecture Constraints",
        "- API schema changes require explicit migration notes.",
        "- Do not introduce cross-module imports from `app/*` into `domain/*`."
      ].join("\n")
    };
    saveConfig(repoRoot, config);

    const syncResult = await runSyncCommand(repoRoot, false);
    expect(syncResult.ok).toBe(true);

    const projectProfilePath = path.join(repoRoot, ".ai", "rules", "project-profile.mdc");
    const syncedProjectProfile = fs.readFileSync(projectProfilePath, "utf8");
    expect(syncedProjectProfile).toContain("## Project-Specific Rules");
    expect(syncedProjectProfile).toContain("API schema changes require explicit migration notes.");
    expect(syncedProjectProfile).toContain("Do not introduce cross-module imports");

    fs.writeFileSync(projectProfilePath, "# manual overwrite\n");

    const updateResult = await runUpdateCommand(repoRoot, false);
    expect(updateResult.ok).toBe(true);

    const updatedProjectProfile = fs.readFileSync(projectProfilePath, "utf8");
    expect(updatedProjectProfile).toContain("## Project-Specific Rules");
    expect(updatedProjectProfile).toContain("API schema changes require explicit migration notes.");
    expect(updatedProjectProfile).not.toContain("# manual overwrite");
  });

  test("sync and update regenerate manifesto from config markdown", async () => {
    const repoRoot = makeTempRepo("ai-simple-manifesto-markdown-");
    await runInitCommand({
      repoRoot,
      projectName: "Manifesto Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const config = loadConfig(repoRoot);
    config.manifesto.markdown = [
      "# Project Workflow Manifesto",
      "",
      "## Non-Negotiables",
      "",
      "- Every behavior change requires explicit spec notes.",
      "- Every non-trivial task must leave behind verification evidence."
    ].join("\n");
    saveConfig(repoRoot, config);

    const syncResult = await runSyncCommand(repoRoot, false);
    expect(syncResult.ok).toBe(true);

    const manifestoPath = path.join(repoRoot, "MANIFESTO.md");
    const syncedManifesto = fs.readFileSync(manifestoPath, "utf8");
    expect(syncedManifesto).toContain("## Non-Negotiables");
    expect(syncedManifesto).toContain("Every behavior change requires explicit spec notes.");
    expect(syncedManifesto).not.toContain("## Profile Notes");

    fs.writeFileSync(manifestoPath, "# manual manifesto overwrite\n");

    const updateResult = await runUpdateCommand(repoRoot, false);
    expect(updateResult.ok).toBe(true);

    const updatedManifesto = fs.readFileSync(manifestoPath, "utf8");
    expect(updatedManifesto).toContain("## Non-Negotiables");
    expect(updatedManifesto).toContain("Every non-trivial task must leave behind verification evidence.");
    expect(updatedManifesto).not.toContain("# manual manifesto overwrite");
  });

  test("sync and update regenerate agents from config markdown", async () => {
    const repoRoot = makeTempRepo("ai-simple-agents-markdown-");
    await runInitCommand({
      repoRoot,
      projectName: "Agents Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const config = loadConfig(repoRoot);
    config.agents = {
      markdown: [
        "# AGENTS.md",
        "",
        "## Repo-Specific Constraints",
        "",
        "- Always treat `apps/api` as the system-of-record boundary.",
        "- Never modify deployment manifests without updating rollout notes."
      ].join("\n")
    };
    saveConfig(repoRoot, config);

    const syncResult = await runSyncCommand(repoRoot, false);
    expect(syncResult.ok).toBe(true);

    const agentsPath = path.join(repoRoot, "AGENTS.md");
    const syncedAgents = fs.readFileSync(agentsPath, "utf8");
    expect(syncedAgents).toContain("## Repo-Specific Constraints");
    expect(syncedAgents).toContain("Always treat `apps/api` as the system-of-record boundary.");
    expect(syncedAgents).not.toContain("This repository uses the `ai-simple-template` workflow baseline.");

    fs.writeFileSync(agentsPath, "# manual agents overwrite\n");

    const updateResult = await runUpdateCommand(repoRoot, false);
    expect(updateResult.ok).toBe(true);

    const updatedAgents = fs.readFileSync(agentsPath, "utf8");
    expect(updatedAgents).toContain("## Repo-Specific Constraints");
    expect(updatedAgents).toContain("Never modify deployment manifests without updating rollout notes.");
    expect(updatedAgents).not.toContain("# manual agents overwrite");
  });

  test("update completes without git-based copier update", async () => {
    const repoRoot = copyFixture("python-fastapi-docker");
    await runAdoptCommand({ repoRoot, dryRun: false });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify({ stale: true }, null, 2) + "\n"
    );

    const result = await runUpdateCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".copier-update-marker"))).toBe(false);
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("update restores shared skills and rules links for existing projects", async () => {
    const repoRoot = copyFixture("python-fastapi-docker");
    await runAdoptCommand({ repoRoot, dryRun: false });

    fs.rmSync(path.join(repoRoot, ".cursor", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".cursor", "reference"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".cursor", "context"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".cursor", "linear-scope.json"), { force: true });
    fs.rmSync(path.join(repoRoot, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"), { force: true });
    fs.rmSync(path.join(repoRoot, ".claude", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".agent", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".codex", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".agents", "skills"), { recursive: true, force: true });
    fs.mkdirSync(path.join(repoRoot, ".cursor", "commands"), { recursive: true });
    fs.rmSync(path.join(repoRoot, ".claude", "rules"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".codex", "rules"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".agent", "rules"), { recursive: true, force: true });

    const result = await runUpdateCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "commands"))).toBe(false);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "reference")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "context")).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "linear-scope.json"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"))).toBe(false);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".claude", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".codex", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agents", "skills")).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "reference"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "reference"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "context"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "context"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".claude", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agent", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agents", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.lstatSync(path.join(repoRoot, ".claude", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".codex", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(repoRoot, ".claude", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agent", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".cursor", "rules"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "rules"))
    );
  });

  test("update recreates local copier answers metadata without git refs", async () => {
    const repoRoot = copyFixture("python-fastapi-docker");
    await runAdoptCommand({ repoRoot, dryRun: false });

    fs.rmSync(path.join(repoRoot, ".copier-answers.yml"), { force: true });

    const result = await runUpdateCommand(repoRoot, false);
    const answersContent = fs.readFileSync(path.join(repoRoot, ".copier-answers.yml"), "utf8");

    expect(result.ok).toBe(true);
    expect(answersContent).toContain("_src_path:");
    expect(answersContent).not.toContain("_commit:");
    expect(answersContent).not.toContain("_subdirectory:");
  });

  test("init falls back to uvx when copier binary is missing", async () => {
    const repoRoot = makeTempRepo("ai-simple-uvx-init-");
    const fakeBinDir = makeTempRepo("ai-simple-uvx-bin-");
    createFakeExecutable(
      fakeBinDir,
      "copier",
      `#!/usr/bin/env node
process.exit(1);
`
    );
    createFakeExecutable(
      fakeBinDir,
      "uvx",
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const mode = args.includes("copy") ? "copy" : args.includes("update") ? "update" : "help";
if (mode === "help") process.exit(0);
const destinationPath = mode === "copy" ? args[args.length - 1] : process.cwd();
fs.mkdirSync(path.join(destinationPath, ".cursor"), { recursive: true });
fs.mkdirSync(path.join(destinationPath, ".agents"), { recursive: true });
fs.mkdirSync(path.join(destinationPath, ".ai", "runtime"), { recursive: true });
fs.writeFileSync(path.join(destinationPath, "AGENTS.md"), "# generated\\n");
fs.writeFileSync(path.join(destinationPath, "Taskfile.yml"), "version: \\"3\\"\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "settings.json"), "{\\"plugins\\":{\\"linear\\":{\\"enabled\\":true}}}\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "linear-scope.json"), "[]\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"), "# generated\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "README.md"), "generated\\n");
fs.writeFileSync(path.join(destinationPath, ".agents", "README.md"), "generated\\n");
fs.writeFileSync(path.join(destinationPath, ".ai", "runtime", "task-state.mjs"), "console.log('ok')\\n");
fs.writeFileSync(path.join(destinationPath, ".ai", "runtime", "review-state.mjs"), "console.log('ok')\\n");
fs.writeFileSync(path.join(destinationPath, ".copier-answers.yml"), "project_slug: fixture\\n");
`
    );

    delete process.env.AI_SIMPLE_COPIER_BIN;
    process.env.PATH = `${fakeBinDir}:${process.env.PATH ?? ""}`;

    const result = await runInitCommand({
      repoRoot,
      projectName: "UVX Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, CONFIG_FILE_NAME))).toBe(true);
  });

  test("mcp scaffold, manifesto init and llms build are callable independently", async () => {
    const repoRoot = makeTempRepo("ai-simple-manual-");
    await runInitCommand({
      repoRoot,
      projectName: "Manual Demo",
      profileId: "laravel-docker",
      dryRun: false
    });

    const mcpResult = runMcpScaffoldCommand(repoRoot);
    const manifestoResult = runManifestoInitCommand(repoRoot);
    const llmsResult = await runLlmsBuildCommand(repoRoot);

    expect(mcpResult.ok).toBe(true);
    expect(manifestoResult.ok).toBe(true);
    expect(llmsResult.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "mcp", "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "MANIFESTO.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "llms", "README.md"))).toBe(true);
  });

  test("linear init scaffolds scope and settings files", async () => {
    const repoRoot = makeTempRepo("aiforge-linear-init-");
    await runInitCommand({
      repoRoot,
      projectName: "Linear Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const result = runLinearInitCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "linear-scope.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "settings.json"))).toBe(true);
  });

  test("linear scope set updates config and generated scope", async () => {
    const repoRoot = makeTempRepo("aiforge-linear-scope-");
    await runInitCommand({
      repoRoot,
      projectName: "Linear Scope Demo",
      profileId: "laravel-docker",
      dryRun: false
    });

    const result = runLinearScopeSetCommand(repoRoot, {
      team: "Vertex Backend",
      teamId: "team-123",
      project: "Kernel",
      projectId: "project-456",
      defaultLabels: ["backend", "automation"]
    });

    expect(result.ok).toBe(true);

    const configContent = fs.readFileSync(path.join(repoRoot, CONFIG_FILE_NAME), "utf8");
    const scopeContent = fs.readFileSync(path.join(repoRoot, ".ai", "linear-scope.json"), "utf8");
    const settingsContent = fs.readFileSync(path.join(repoRoot, ".cursor", "settings.json"), "utf8");

    expect(configContent).toContain("tracker: linear");
    expect(scopeContent).toContain("Vertex Backend");
    expect(scopeContent).toContain("automation");
    expect(settingsContent).toContain("\"enabled\": true");
  });

  test("review runtime blocks stop until clean verdict is recorded", async () => {
    const repoRoot = makeTempRepo("ai-simple-review-runtime-");
    await runInitCommand({
      repoRoot,
      projectName: "Review Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installReviewRuntime(repoRoot);
    const stopGuardPath = installStopGuard(repoRoot);

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify(
        {
          task: {
            tasks: {
              verify: "verify",
              review: "review"
            }
          }
        },
        null,
        2
      ) + "\n"
    );

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "task-state.json"),
      JSON.stringify(
        {
          history: [{ stage: "post", taskName: "verify", timestamp: new Date().toISOString() }]
        },
        null,
        2
      ) + "\n"
    );

    const initialGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(initialGuard.stopReason).toBe("review_missing");

    runNodeScript(path.join(repoRoot, ".ai", "runtime", "review-state.mjs"), ["start"], repoRoot);
    const pendingGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(pendingGuard.stopReason).toBe("review_pending");

    runNodeScript(
      path.join(repoRoot, ".ai", "runtime", "review-state.mjs"),
      ["verdict", "clean", "review passed"],
      repoRoot
    );
    const cleanGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(cleanGuard.continue).toBe(true);
  });

  test("codex hooks derive workflow commands from manifest task runner", async () => {
    const repoRoot = makeTempRepo("ai-simple-codex-hooks-");
    await runInitCommand({
      repoRoot,
      projectName: "Codex Hook Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installReviewRuntime(repoRoot);
    installCodexHookTemplates(repoRoot);

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify(
        {
          task: {
            command: "just",
            tasks: {
              verify: "verify",
              review: "review",
              test: "test",
              lint: "lint",
              build: "build"
            }
          }
        },
        null,
        2
      ) + "\n"
    );

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "task-state.json"),
      JSON.stringify(
        {
          history: [{ stage: "post", taskName: "verify", timestamp: new Date().toISOString() }]
        },
        null,
        2
      ) + "\n"
    );

    const stopGuardPath = path.join(repoRoot, ".codex", "hooks", "stop-delivery-guard.mjs");
    const postToolUseGuardPath = path.join(repoRoot, ".codex", "hooks", "post-tool-use-guard.mjs");

    const missingReviewGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(missingReviewGuard.stopReason).toBe("review_missing");
    expect(missingReviewGuard.systemMessage).toContain("Run just review");

    runNodeScript(path.join(repoRoot, ".ai", "runtime", "review-state.mjs"), ["start"], repoRoot);
    const pendingReviewGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(pendingReviewGuard.stopReason).toBe("review_pending");
    expect(pendingReviewGuard.systemMessage).toContain("just review");

    const matchedReviewCommand = JSON.parse(
      runNodeScriptWithInput(
        postToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_input: { command: "just review" } })
      ).stdout
    );
    expect(matchedReviewCommand.systemMessage).toContain("Record the final verdict");

    const unmatchedLegacyCommand = JSON.parse(
      runNodeScriptWithInput(
        postToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_input: { command: "task review" } })
      ).stdout
    );
    expect(unmatchedLegacyCommand.continue).toBe(true);
    expect(unmatchedLegacyCommand.systemMessage).toBeUndefined();
  });

  test("codex stop guard blocks unfinished orchestrator flow", async () => {
    const repoRoot = makeTempRepo("ai-simple-codex-orchestrator-guard-");
    await runInitCommand({
      repoRoot,
      projectName: "Codex Orchestrator Guard Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installCodexHookTemplates(repoRoot);

    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "registry.json"),
      JSON.stringify(
        {
          activeReservations: {
            "APP-17": {
              paths: ["src/service.ts"],
              shared_surfaces: []
            }
          },
          runs: {
            "APP-17": {
              status: "building"
            }
          }
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-17.json"),
      JSON.stringify(
        {
          issueId: "APP-17",
          status: "building",
          currentStep: "implementing",
          worktreePath: repoRoot
        },
        null,
        2
      ) + "\n"
    );

    const stopGuardPath = path.join(repoRoot, ".codex", "hooks", "stop-delivery-guard.mjs");
    const postToolUseGuardPath = path.join(repoRoot, ".codex", "hooks", "post-tool-use-guard.mjs");

    const stopGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(stopGuard.stopReason).toBe("orchestrator_incomplete");
    expect(stopGuard.systemMessage).toContain("APP-17");
    expect(stopGuard.systemMessage).toContain("run_build");

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify(
        {
          task: {
            command: "just",
            tasks: {
              verify: "verify",
              review: "review",
              test: "test",
              lint: "lint",
              build: "build"
            }
          }
        },
        null,
        2
      ) + "\n"
    );

    const postToolUse = JSON.parse(
      runNodeScriptWithInput(
        postToolUseGuardPath,
        [],
        repoRoot,
        JSON.stringify({ tool_input: { command: "just build" } })
      ).stdout
    );
    expect(postToolUse.continue).toBe(true);
    expect(postToolUse.systemMessage).toContain("APP-17");
    expect(postToolUse.systemMessage).toContain("flow_complete");
  });

  test("codex stop guard ignores orchestrator runs from another worktree", async () => {
    const repoRoot = makeTempRepo("ai-simple-codex-orchestrator-unrelated-");
    await runInitCommand({
      repoRoot,
      projectName: "Codex Unrelated Guard Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    installCodexHookTemplates(repoRoot);
    installReviewRuntime(repoRoot);

    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "registry.json"),
      JSON.stringify(
        {
          activeReservations: {
            "APP-99": {
              paths: ["src/other.ts"],
              shared_surfaces: []
            }
          },
          runs: {
            "APP-99": {
              status: "building"
            }
          }
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-99.json"),
      JSON.stringify(
        {
          issueId: "APP-99",
          status: "building",
          currentStep: "implementing",
          worktreePath: "/tmp/worktrees/APP-99"
        },
        null,
        2
      ) + "\n"
    );

    fs.writeFileSync(
      path.join(repoRoot, ".ai", "project.manifest.json"),
      JSON.stringify(
        {
          task: {
            command: "just",
            tasks: {
              verify: "verify",
              review: "review"
            }
          }
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "task-state.json"),
      JSON.stringify(
        {
          history: [{ stage: "post", taskName: "verify", timestamp: new Date().toISOString() }]
        },
        null,
        2
      ) + "\n"
    );
    runNodeScript(path.join(repoRoot, ".ai", "runtime", "review-state.mjs"), ["verdict", "clean"], repoRoot);

    const stopGuardPath = path.join(repoRoot, ".codex", "hooks", "stop-delivery-guard.mjs");
    const stopGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));

    expect(stopGuard.continue).toBe(true);
    expect(stopGuard.stopReason).not.toBe("orchestrator_incomplete");
  });

  test("cursor hooks build current context and block destructive commands", async () => {
    const repoRoot = makeTempRepo("ai-simple-cursor-hooks-");
    await runInitCommand({
      repoRoot,
      projectName: "Cursor Hook Demo",
      profileId: "vue-quasar-capacitor",
      dryRun: false
    });

    installCursorHookTemplates(repoRoot);

    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "registry.json"),
      JSON.stringify(
        {
          activeReservations: {
            "APP-42": {
              paths: ["src/app.ts"],
              shared_surfaces: []
            }
          },
          runs: {
            "APP-42": {
              status: "building"
            }
          }
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-42.json"),
      JSON.stringify(
        {
          issueId: "APP-42",
          status: "building",
          currentStep: "implementing",
          worktreePath: repoRoot
        },
        null,
        2
      ) + "\n"
    );

    const sessionInitPath = path.join(repoRoot, ".cursor", "hooks", "session-init.mjs");
    const auditPath = path.join(repoRoot, ".cursor", "hooks", "audit.mjs");
    const blockDangerPath = path.join(repoRoot, ".cursor", "hooks", "block-danger.mjs");

    runNodeScript(sessionInitPath, [], repoRoot);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "context", "current.md"))).toBe(true);

    const auditResult = runNodeScriptWithInput(
      auditPath,
      [],
      repoRoot,
      JSON.stringify({ event: "beforeSubmitPrompt", prompt: "review this change" })
    );
    expect(auditResult.status).toBe(0);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "hooks", "audit.log"))).toBe(true);

    const currentContent = fs.readFileSync(
      path.join(repoRoot, ".ai", "context", "current.md"),
      "utf8"
    );
    expect(currentContent).toContain("Cursor Hook Demo");
    expect(currentContent).toContain("vue-quasar-capacitor");
    expect(currentContent).toContain("Active issue: APP-42");
    expect(currentContent).toContain("Next action: run_build");
    expect(currentContent).toContain("do not stop until orchestrator reaches flow_complete");

    const safeResult = runNodeScriptWithInput(blockDangerPath, [], repoRoot, "git status");
    expect(safeResult.status).toBe(0);
    expect(safeResult.stdout).toContain("\"permission\": \"allow\"");

    const blockedResult = runNodeScriptWithInput(
      blockDangerPath,
      [],
      repoRoot,
      JSON.stringify({ command: "git reset --hard HEAD~1" })
    );
    expect(blockedResult.status).toBe(2);
    expect(blockedResult.stdout).toContain("\"permission\": \"deny\"");
    expect(blockedResult.stdout).toContain("destructive command");
  });

  test("cursor context ignores orchestrator runs from another worktree", async () => {
    const repoRoot = makeTempRepo("ai-simple-cursor-orchestrator-unrelated-");
    await runInitCommand({
      repoRoot,
      projectName: "Cursor Unrelated Demo",
      profileId: "vue-quasar-capacitor",
      dryRun: false
    });

    installCursorHookTemplates(repoRoot);

    fs.mkdirSync(path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "registry.json"),
      JSON.stringify(
        {
          activeReservations: {
            "APP-77": {
              paths: ["src/app.ts"],
              shared_surfaces: []
            }
          },
          runs: {
            "APP-77": {
              status: "building"
            }
          }
        },
        null,
        2
      ) + "\n"
    );
    fs.writeFileSync(
      path.join(repoRoot, ".ai", "runtime", "orchestrator", "runs", "APP-77.json"),
      JSON.stringify(
        {
          issueId: "APP-77",
          status: "building",
          currentStep: "implementing",
          worktreePath: "/tmp/worktrees/APP-77"
        },
        null,
        2
      ) + "\n"
    );

    const sessionInitPath = path.join(repoRoot, ".cursor", "hooks", "session-init.mjs");
    runNodeScript(sessionInitPath, [], repoRoot);

    const currentContent = fs.readFileSync(path.join(repoRoot, ".ai", "context", "current.md"), "utf8");
    expect(currentContent).toContain("## Orchestrator");
    expect(currentContent).toContain("No active orchestrator run.");
    expect(currentContent).not.toContain("Active issue: APP-77");
  });

  test("project-stub prints a copyable project-specific customization prompt", async () => {
    const repoRoot = makeTempRepo("aiforge-project-stub-");
    await runInitCommand({
      repoRoot,
      projectName: "Stub Demo",
      profileId: "python-fastapi-docker",
      dryRun: false
    });

    const result = runProjectStubCommand(repoRoot);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Project-Specific Aiforge Customization Request");
    expect(result.message).toContain("python-fastapi-docker");
    expect(result.message).toContain("projectRules.markdown");
    expect(result.message).toContain("manifesto.markdown");
    expect(result.message).toContain("agents.markdown");
    expect(result.message).toContain(".cursor/mcp.example.json");
  });
});
