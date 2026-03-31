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
import { CONFIG_FILE_NAME } from "../src/core/config.js";
import {
  createFakeExecutable,
  copyFixture,
  createFakeCopierBin,
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
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "linear-scope.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "rules", "linear-mcp.mdc"))).toBe(true);
    expect(runDoctorCommand(repoRoot).ok).toBe(true);
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

    const result = await runSyncCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "MANIFESTO.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "llms.txt"))).toBe(true);
  });

  test("update writes copier marker via fake copier", async () => {
    const repoRoot = copyFixture("python-fastapi-docker");
    await runAdoptCommand({ repoRoot, dryRun: false });

    const result = await runUpdateCommand(repoRoot, false);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".copier-update-marker"))).toBe(true);
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
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "linear-scope.json"))).toBe(true);
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
    const scopeContent = fs.readFileSync(path.join(repoRoot, ".cursor", "linear-scope.json"), "utf8");
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
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "context", "current.md"))).toBe(true);

    const auditResult = runNodeScriptWithInput(
      auditPath,
      [],
      repoRoot,
      JSON.stringify({ event: "beforeSubmitPrompt", prompt: "review this change" })
    );
    expect(auditResult.status).toBe(0);
    expect(fs.existsSync(path.join(repoRoot, ".cursor", "hooks", "audit.log"))).toBe(true);

    const currentContent = fs.readFileSync(
      path.join(repoRoot, ".cursor", "context", "current.md"),
      "utf8"
    );
    expect(currentContent).toContain("Cursor Hook Demo");
    expect(currentContent).toContain("vue-quasar-capacitor");

    const safeResult = runNodeScriptWithInput(blockDangerPath, [], repoRoot, "git status");
    expect(safeResult.status).toBe(0);

    const blockedResult = runNodeScriptWithInput(
      blockDangerPath,
      [],
      repoRoot,
      JSON.stringify({ command: "git reset --hard HEAD~1" })
    );
    expect(blockedResult.status).toBe(1);
    expect(blockedResult.stderr).toContain("destructive command");
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
    expect(result.message).toContain(".cursor/rules/project-profile.mdc");
    expect(result.message).toContain(".cursor/mcp.example.json");
  });
});
