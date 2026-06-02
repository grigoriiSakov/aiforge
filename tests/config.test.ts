import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { MODEL_PROFILES_MANIFEST_PATH } from "../src/core/agent-models.js";
import {
  CONFIG_FILE_NAME,
  MACHINE_MANIFEST_PATH,
  createConfig,
  loadConfig,
  saveConfig
} from "../src/core/config.js";
import { DEFAULT_TASK_COMMAND } from "../src/core/task-runner.js";
import { makeTempRepo } from "./helpers.js";

describe("config lifecycle", () => {
  test("saves yaml config and machine manifest", () => {
    const repoRoot = makeTempRepo("ai-simple-config-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "laravel-docker"
    });

    const configPath = saveConfig(repoRoot, config);

    expect(configPath).toBe(path.join(repoRoot, CONFIG_FILE_NAME));
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, MACHINE_MANIFEST_PATH))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, MODEL_PROFILES_MANIFEST_PATH))).toBe(true);
    expect(loadConfig(repoRoot).profile.id).toBe("laravel-docker");
    expect(loadConfig(repoRoot).agents.modelTiers.implement).toBe("quality");
  });

  test("profile carries linear defaults", () => {
    const repoRoot = makeTempRepo("aiforge-config-linear-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo-web",
      projectName: "Demo Web",
      profileId: "vue-quasar-capacitor"
    });

    expect(config.linear.enabled).toBe(true);
    expect(config.linear.requireTrackerForIssueFlow).toBe(true);
    expect(config.linear.scopes[0]?.defaultLabels).toEqual(["frontend"]);
    expect(config.workflow.trackerStates).toEqual({
      planReady: "Todo",
      active: "In Progress",
      review: "In Review"
    });
    expect(config.orchestrator.branchPrefix).toBe("agent/");
    expect(config.orchestrator.maxReviewIterations).toBe(2);
    expect(config.orchestrator.auditGate).toBe("never");
    expect(config.artifacts.planProgressRoot).toBe(".ai/context/runtime");
    expect(config.execution.canonicalRoot).toBe(".");
    expect(config.execution.worktreeEnvVar).toBe("AIFORGE_WORKTREE_PATH");
    expect(config.execution.worktreeStrategy).toBe("direct");
    expect(config.execution.entrypoints.verify).toBe(`${DEFAULT_TASK_COMMAND} verify`);
  });

  test("legacy task command config migrates to repo-local go-task runner", () => {
    const repoRoot = makeTempRepo("aiforge-config-legacy-task-");
    fs.writeFileSync(
      path.join(repoRoot, CONFIG_FILE_NAME),
      [
        "schemaVersion: 1",
        "project:",
        "  slug: demo",
        "  name: Demo",
        "  mainBranch: dev",
        "workflow:",
        "  tracker: linear",
        "  phases: [issue, plan, build, test, review]",
        "  language: ru",
        "  trackerStates:",
        "    planReady: Todo",
        "    active: In Progress",
        "    review: In Review",
        "linear:",
        "  enabled: true",
        "  requireTrackerForIssueFlow: true",
        "  scopes: []",
        "profile:",
        "  id: python-fastapi-docker",
        "orchestrator:",
        "  worktreeRoot: ~/worktrees/demo",
        "  branchPrefix: agent/",
        "  maxReviewIterations: 3",
        "artifacts:",
        "  planProgressRoot: .ai/context/runtime",
        "runtimes:",
        "  cursor: true",
        "  codex: true",
        "  claude: true",
        "  agent: true",
        "  agents: true",
        "task:",
        "  command: task",
        "  tasks:",
        "    build: build",
        "    test: test",
        "    lint: lint",
        "    verify: verify",
        "    review: review",
        "commands:",
        "  build:",
        "    - echo \"No dedicated implement step for FastAPI profile\"",
        "  test:",
        "    - cd ../docker && docker compose exec app uv run python scripts/run_pytest_isolated.py -v",
        "  lint:",
        "    - cd ../docker && docker compose exec app uv run ruff check .",
        "  verify:",
        "    - python3 scripts/check_import_boundaries.py",
        "    - task lint",
        "    - task test",
        "  review:",
        "    - task verify",
        "    - echo \"Review evidence collected. Record final verdict via review-state.mjs.\"",
        "manifesto:",
        "  path: MANIFESTO.md",
        "  title: Modular Backend Manifesto",
        "  markdown: \"\"",
        "agents:",
        "  markdown: \"\"",
        "llms:",
        "  rootDir: llms",
        "  txtPath: llms.txt",
        "  sourceGlobs:",
        "    - src/**/*.py",
        "mcp:",
        "  scaffold: true",
        "  placeholders: [linear, framework-docs, project-db]",
        "projectRules:",
        "  markdown: \"\"",
        "managedSurfaces: []",
        "updatePolicy: strict",
        "features:",
        "  mcp: true",
        "  llms: true",
        "  manifesto: true",
        ""
      ].join("\n")
    );

    const config = loadConfig(repoRoot);

    expect(config.task.command).toBe(DEFAULT_TASK_COMMAND);
    expect(config.workflow.phases).toEqual(["issue", "plan", "implement", "test", "review"]);
    expect(config.task.tasks.implement).toBe("implement");
    expect(config.commands.implement).toEqual([
      'echo "No dedicated implement step for FastAPI profile"'
    ]);
    expect(config.commands.verify).toContain(`${DEFAULT_TASK_COMMAND} lint`);
    expect(config.commands.verify).toContain(`${DEFAULT_TASK_COMMAND} test`);
    expect(config.commands.review).toContain(`${DEFAULT_TASK_COMMAND} verify`);
    expect(config.execution.entrypoints.implement).toBe(`${DEFAULT_TASK_COMMAND} implement`);
    expect(config.execution.entrypoints.lint).toBe(`${DEFAULT_TASK_COMMAND} lint`);
    expect(config.execution.entrypoints.test).toBe(`${DEFAULT_TASK_COMMAND} test`);
    expect(config.execution.entrypoints.verify).toBe(`${DEFAULT_TASK_COMMAND} verify`);
  });
});
