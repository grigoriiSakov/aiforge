import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, test } from "vitest";

import { runAdoptCommand } from "../src/commands/adopt.js";
import { runDoctorCommand } from "../src/commands/doctor.js";
import { runInitCommand } from "../src/commands/init.js";
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
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "rules", "linear-mcp.mdc"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "skills", "plan", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".agents", "runtime", "orchestrator-state.mjs"))).toBe(true);
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
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "rules"))).toBe(
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
    const runtimeDir = path.join(repoRoot, ".agents", "runtime");
    fs.mkdirSync(runtimeDir, { recursive: true });

    const templatePath = path.join(
      process.cwd(),
      "template",
      "base",
      ".agents",
      "runtime",
      "orchestrator-state.mjs.jinja"
    );
    const renderedRuntime = fs
      .readFileSync(templatePath, "utf8")
      .replaceAll("{{ main_branch }}", "main")
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
    expect(fs.existsSync(path.join(repoRoot, ".agents", "project.manifest.json"))).toBe(false);
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
      path.join(repoRoot, ".agents", "project.manifest.json"),
      JSON.stringify({ stale: true }, null, 2) + "\n"
    );

    const result = await runSyncCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "MANIFESTO.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "llms.txt"))).toBe(true);
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
  });

  test("sync backfills new config sections for older projects", async () => {
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
    expect(syncedConfig).toContain("\nprojectRules:\n");
    expect(syncedConfig).toContain("\nagents:\n  markdown: \"\"");
    expect(syncedConfig).toContain("\nmanifesto:\n");
    expect(syncedConfig).toContain("\n  markdown: \"\"");
    expect(syncedConfig).toContain("- path: .ai");
    expect(syncedConfig).toContain("\n  trackerStates:\n");
    expect(syncedConfig).toContain("\norchestrator:\n");
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
      path.join(repoRoot, ".agents", "project.manifest.json"),
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
    fs.rmSync(path.join(repoRoot, ".agent", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".codex", "skills"), { recursive: true, force: true });
    fs.rmSync(path.join(repoRoot, ".agents", "skills"), { recursive: true, force: true });
    fs.mkdirSync(path.join(repoRoot, ".cursor", "commands"), { recursive: true });
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
    expect(fs.realpathSync(path.join(repoRoot, ".agent", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".codex", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.realpathSync(path.join(repoRoot, ".agents", "skills"))).toBe(
      fs.realpathSync(path.join(repoRoot, ".ai", "skills"))
    );
    expect(fs.lstatSync(path.join(repoRoot, ".codex", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".agent", "rules")).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(repoRoot, ".cursor", "rules")).isSymbolicLink()).toBe(true);
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
fs.mkdirSync(path.join(destinationPath, ".agents", "runtime"), { recursive: true });
fs.writeFileSync(path.join(destinationPath, "AGENTS.md"), "# generated\\n");
fs.writeFileSync(path.join(destinationPath, "Taskfile.yml"), "version: \\"3\\"\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "settings.json"), "{\\"plugins\\":{\\"linear\\":{\\"enabled\\":true}}}\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "linear-scope.json"), "[]\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"), "# generated\\n");
fs.writeFileSync(path.join(destinationPath, ".cursor", "README.md"), "generated\\n");
fs.writeFileSync(path.join(destinationPath, ".agents", "README.md"), "generated\\n");
fs.writeFileSync(path.join(destinationPath, ".agents", "runtime", "task-state.mjs"), "console.log('ok')\\n");
fs.writeFileSync(path.join(destinationPath, ".agents", "runtime", "review-state.mjs"), "console.log('ok')\\n");
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
      path.join(repoRoot, ".agents", "project.manifest.json"),
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
      path.join(repoRoot, ".agents", "runtime", "task-state.json"),
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

    runNodeScript(path.join(repoRoot, ".agents", "runtime", "review-state.mjs"), ["start"], repoRoot);
    const pendingGuard = JSON.parse(runNodeScript(stopGuardPath, [], repoRoot));
    expect(pendingGuard.stopReason).toBe("review_pending");

    runNodeScript(
      path.join(repoRoot, ".agents", "runtime", "review-state.mjs"),
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
      path.join(repoRoot, ".agents", "project.manifest.json"),
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
      path.join(repoRoot, ".agents", "runtime", "task-state.json"),
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

    runNodeScript(path.join(repoRoot, ".agents", "runtime", "review-state.mjs"), ["start"], repoRoot);
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

  test("cursor hooks build current context and block destructive commands", async () => {
    const repoRoot = makeTempRepo("ai-simple-cursor-hooks-");
    await runInitCommand({
      repoRoot,
      projectName: "Cursor Hook Demo",
      profileId: "vue-quasar-capacitor",
      dryRun: false
    });

    installCursorHookTemplates(repoRoot);

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
