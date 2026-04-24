import path from "node:path";

import YAML from "yaml";

import { ensureDir, readTextFileIfExists, writeTextFile } from "./filesystem.js";
import { ensureInstallerState } from "./state.js";
import { getProfileDefinition } from "./profiles/definitions.js";
import { DEFAULT_TASK_COMMAND, renderTaskCommands } from "./task-runner.js";
import type { DetectionResult, ProjectConfig, ProjectProfileId } from "./types.js";

export const CONFIG_FILE_NAME = "ai.config.yaml";
export const MACHINE_MANIFEST_PATH = path.join(".ai", "project.manifest.json");
const DEFAULT_WORKTREE_ENV_VAR = "AIFORGE_WORKTREE_PATH";
const DEFAULT_EXECUTION_ROOT = ".";
const DEFAULT_WORKTREE_STRATEGY = "direct";

export function createConfig(params: {
  repoRoot: string;
  projectSlug: string;
  projectName: string;
  profileId: ProjectProfileId;
  detectionResult?: DetectionResult;
}): ProjectConfig {
  const profile = getProfileDefinition(params.profileId);
  const taskCommand = DEFAULT_TASK_COMMAND;
  const task = {
    command: taskCommand,
    tasks: {
      build: "build",
      test: "test",
      lint: "lint",
      verify: "verify",
      review: "review"
    }
  };

  return {
    schemaVersion: 1,
    project: {
      slug: params.projectSlug,
      name: params.projectName,
      mainBranch: "dev"
    },
    workflow: {
      tracker: profile.trackerDefault,
      phases: ["issue", "plan", "build", "test", "review"],
      language: profile.languageDefault,
      trackerStates: {
        planReady: "Todo",
        active: "In Progress",
        review: "In Review"
      }
    },
    linear: {
      enabled: profile.linearDefaults.enabled,
      requireTrackerForIssueFlow: profile.trackerDefault === "linear",
      scopes: profile.linearDefaults.scopes
    },
    profile: {
      id: params.profileId,
      ...(params.detectionResult?.reasons ? { detectedFrom: params.detectionResult.reasons } : {})
    },
    orchestrator: {
      worktreeRoot: `~/worktrees/${params.projectSlug}`,
      branchPrefix: "agent/",
      maxReviewIterations: 3
    },
    execution: createDefaultExecutionConfig(task),
    artifacts: {
      planProgressRoot: ".ai/context/runtime"
    },
    runtimes: {
      cursor: true,
      codex: true,
      claude: true,
      agent: true,
      agents: true
    },
    task,
    commands: renderTaskCommands(profile.taskCommands, taskCommand),
    manifesto: {
      path: "MANIFESTO.md",
      title: profile.manifestoTitle,
      markdown: ""
    },
    agents: {
      markdown: ""
    },
    llms: {
      rootDir: "llms",
      txtPath: "llms.txt",
      sourceGlobs: profile.llmsSourceGlobs
    },
    mcp: {
      scaffold: true,
      placeholders: ["linear", "framework-docs", "project-db"]
    },
    projectRules: {
      markdown: ""
    },
    managedSurfaces: [
      { path: ".aiforge.json", policy: "managed" },
      { path: ".ai", policy: "managed" },
      { path: "AGENTS.md", policy: "managed" },
      { path: "MANIFESTO.md", policy: "managed" },
      { path: "Taskfile.yml", policy: "managed" },
      { path: "llms.txt", policy: "managed" },
      { path: "llms", policy: "managed" },
      { path: ".cursor", policy: "managed" },
      { path: ".codex", policy: "managed" },
      { path: ".claude", policy: "managed" },
      { path: ".agent", policy: "managed" },
      { path: ".agents", policy: "managed" }
    ],
    updatePolicy: "strict",
    features: {
      mcp: true,
      llms: true,
      manifesto: true
    }
  };
}

export function loadConfig(repoRoot: string): ProjectConfig {
  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  const content = readTextFileIfExists(configPath);

  if (!content) {
    throw new Error(`Config file not found: ${CONFIG_FILE_NAME}`);
  }

  const parsed = YAML.parse(content) as ProjectConfig;
  const normalized = normalizeConfig(parsed);
  validateConfig(normalized);
  return normalized;
}

export function saveConfig(repoRoot: string, config: ProjectConfig): string {
  const normalized = normalizeConfig(config);
  validateConfig(normalized);
  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  writeTextFile(configPath, YAML.stringify(normalized));
  writeMachineManifest(repoRoot, normalized);
  return configPath;
}

export function writeMachineManifest(repoRoot: string, config: ProjectConfig): string {
  const normalized = normalizeConfig(config);
  validateConfig(normalized);
  const manifestPath = path.join(repoRoot, MACHINE_MANIFEST_PATH);
  ensureDir(path.dirname(manifestPath));
  writeTextFile(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`);
  ensureInstallerState(repoRoot, normalized);
  return manifestPath;
}

export function buildCopierAnswers(config: ProjectConfig): Record<string, unknown> {
  return {
    project_slug: config.project.slug,
    project_name: config.project.name,
    main_branch: config.project.mainBranch,
    workflow_tracker: config.workflow.tracker,
    workflow_language: config.workflow.language,
    tracker_status_plan_ready: config.workflow.trackerStates.planReady,
    tracker_status_active: config.workflow.trackerStates.active,
    tracker_status_review: config.workflow.trackerStates.review,
    linear_enabled: config.linear.enabled,
    linear_require_tracker: config.linear.requireTrackerForIssueFlow,
    linear_scopes: config.linear.scopes,
    profile_id: config.profile.id,
    orchestrator_worktree_root: config.orchestrator.worktreeRoot,
    orchestrator_branch_prefix: config.orchestrator.branchPrefix,
    orchestrator_max_review_iterations: config.orchestrator.maxReviewIterations,
    execution_canonical_root: config.execution.canonicalRoot,
    execution_worktree_env_var: config.execution.worktreeEnvVar,
    execution_worktree_strategy: config.execution.worktreeStrategy,
    execution_build_entrypoint: config.execution.entrypoints.build,
    execution_test_entrypoint: config.execution.entrypoints.test,
    execution_lint_entrypoint: config.execution.entrypoints.lint,
    execution_verify_entrypoint: config.execution.entrypoints.verify,
    execution_review_entrypoint: config.execution.entrypoints.review,
    plan_progress_runtime_root: config.artifacts.planProgressRoot,
    enable_cursor: config.runtimes.cursor,
    enable_codex: config.runtimes.codex,
    enable_claude: config.runtimes.claude,
    enable_agent: config.runtimes.agent,
    enable_agents: config.runtimes.agents,
    manifesto_title: config.manifesto.title,
    manifesto_path: config.manifesto.path,
    llms_root_dir: config.llms.rootDir,
    llms_txt_path: config.llms.txtPath,
    llms_source_globs: config.llms.sourceGlobs,
    task_command: config.task.command,
    task_build_name: config.task.tasks.build,
    task_test_name: config.task.tasks.test,
    task_lint_name: config.task.tasks.lint,
    task_verify_name: config.task.tasks.verify,
    task_review_name: config.task.tasks.review,
    commands: config.commands,
    profile_notes: getProfileDefinition(config.profile.id).notes,
    mcp_placeholders: config.mcp.placeholders,
    project_rules_markdown: config.projectRules?.markdown ?? "",
    agents_markdown: config.agents?.markdown ?? ""
  };
}

function validateConfig(config: ProjectConfig): void {
  if (config.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${String(config.schemaVersion)}`);
  }

  if (!config.project.slug || !config.project.name) {
    throw new Error("Config project.slug and project.name are required");
  }

  if (!config.profile.id) {
    throw new Error("Config profile.id is required");
  }

  if (
    !config.workflow?.trackerStates?.planReady ||
    !config.workflow?.trackerStates?.active ||
    !config.workflow?.trackerStates?.review
  ) {
    throw new Error("Config workflow.trackerStates.{planReady,active,review} are required");
  }

  if (!config.orchestrator?.worktreeRoot || !config.orchestrator?.branchPrefix) {
    throw new Error("Config orchestrator.worktreeRoot and orchestrator.branchPrefix are required");
  }

  if (
    !Number.isInteger(config.orchestrator.maxReviewIterations) ||
    config.orchestrator.maxReviewIterations < 1
  ) {
    throw new Error("Config orchestrator.maxReviewIterations must be an integer >= 1");
  }

  if (!config.execution?.canonicalRoot?.trim()) {
    throw new Error("Config execution.canonicalRoot is required");
  }

  if (!config.execution?.worktreeEnvVar?.trim()) {
    throw new Error("Config execution.worktreeEnvVar is required");
  }

  if (!["direct", "overlay"].includes(config.execution?.worktreeStrategy ?? "")) {
    throw new Error("Config execution.worktreeStrategy must be one of: direct, overlay");
  }

  if (
    !config.execution?.entrypoints?.build?.trim() ||
    !config.execution?.entrypoints?.test?.trim() ||
    !config.execution?.entrypoints?.lint?.trim() ||
    !config.execution?.entrypoints?.verify?.trim() ||
    !config.execution?.entrypoints?.review?.trim()
  ) {
    throw new Error("Config execution.entrypoints.{build,test,lint,verify,review} are required");
  }

  if (!config.artifacts?.planProgressRoot?.trim()) {
    throw new Error("Config artifacts.planProgressRoot is required");
  }

  if (!config.manifesto?.path || !config.manifesto?.title) {
    throw new Error("Config manifesto.path and manifesto.title are required");
  }

  if (config.manifesto.markdown !== undefined && typeof config.manifesto.markdown !== "string") {
    throw new Error("Config manifesto.markdown must be a string when provided");
  }

  if (config.agents && typeof config.agents !== "object") {
    throw new Error("Config agents must be an object when provided");
  }

  if (config.agents?.markdown !== undefined && typeof config.agents.markdown !== "string") {
    throw new Error("Config agents.markdown must be a string when provided");
  }

  if (config.projectRules && typeof config.projectRules !== "object") {
    throw new Error("Config projectRules must be an object when provided");
  }

  if (
    config.projectRules?.markdown !== undefined &&
    typeof config.projectRules.markdown !== "string"
  ) {
    throw new Error("Config projectRules.markdown must be a string when provided");
  }

  getProfileDefinition(config.profile.id);
}

/**
 * Rebases `profile.id` and profile-derived **command templates** onto the existing config
 * without clobbering repo-local truth: Linear scopes, workflow tracker/language, manifesto
 * body, agents/projectRules prose, and non-empty llms globs stay as in `ai.config.yaml`.
 */
export function applyProfileToConfig(config: ProjectConfig, profileId: ProjectProfileId): ProjectConfig {
  const profile = getProfileDefinition(profileId);
  const taskCommand = normalizeTaskCommand(config.task?.command);
  const task = {
    ...config.task,
    command: taskCommand
  };
  const profileCommands = renderTaskCommands(profile.taskCommands, taskCommand);
  const userGlobs = config.llms?.sourceGlobs;
  const sourceGlobs =
    Array.isArray(userGlobs) && userGlobs.length > 0 ? userGlobs : profile.llmsSourceGlobs;
  const isProfileSwitch = config.profile.id !== profileId;
  const commands = isProfileSwitch
    ? profileCommands
    : {
        ...profileCommands,
        ...config.commands
      };
  return {
    ...config,
    profile: {
      ...config.profile,
      id: profileId
    },
    workflow: {
      ...config.workflow
    },
    linear: {
      ...config.linear
    },
    task,
    execution: normalizeExecutionConfig(config.execution, task),
    commands,
    manifesto: {
      ...config.manifesto
    },
    agents: {
      ...config.agents
    },
    llms: {
      ...config.llms,
      sourceGlobs
    },
    projectRules: {
      ...config.projectRules
    }
  };
}

function normalizeConfig(config: ProjectConfig): ProjectConfig {
  const defaults = createConfig({
    repoRoot: "",
    projectSlug: config.project?.slug ?? "project",
    projectName: config.project?.name ?? "Project",
    profileId: config.profile?.id ?? "python-fastapi-docker"
  });
  const profileId = config.profile?.id ?? defaults.profile.id;
  const profile = getProfileDefinition(profileId);
  const taskCommand = normalizeTaskCommand(config.task?.command);
  const task = {
    ...defaults.task,
    ...config.task,
    command: taskCommand,
    tasks: {
      ...defaults.task.tasks,
      ...config.task?.tasks
    }
  };

  return {
    ...defaults,
    ...config,
    project: {
      ...defaults.project,
      ...config.project
    },
    workflow: {
      ...defaults.workflow,
      ...config.workflow,
      trackerStates: {
        ...defaults.workflow.trackerStates,
        ...config.workflow?.trackerStates
      }
    },
    linear: {
      ...defaults.linear,
      ...config.linear
    },
    profile: {
      ...defaults.profile,
      ...config.profile,
      id: profileId
    },
    orchestrator: {
      ...defaults.orchestrator,
      ...config.orchestrator
    },
    artifacts: {
      ...defaults.artifacts,
      ...config.artifacts
    },
    runtimes: {
      ...defaults.runtimes,
      ...config.runtimes
    },
    task,
    execution: normalizeExecutionConfig(config.execution, task),
    commands: normalizeTaskCommands(config.commands, profile.taskCommands, taskCommand),
    manifesto: {
      ...defaults.manifesto,
      ...config.manifesto
    },
    agents: {
      ...defaults.agents,
      ...config.agents
    },
    llms: {
      ...defaults.llms,
      ...config.llms
    },
    mcp: {
      ...defaults.mcp,
      ...config.mcp
    },
    projectRules: {
      ...defaults.projectRules,
      ...config.projectRules
    },
    managedSurfaces: mergeManagedSurfaces(config.managedSurfaces, defaults.managedSurfaces),
    features: {
      ...defaults.features,
      ...config.features
    }
  };
}

function normalizeTaskCommand(taskCommand: string | undefined): string {
  if (!taskCommand || taskCommand === "task" || taskCommand === "go-task") {
    return DEFAULT_TASK_COMMAND;
  }

  return taskCommand;
}

function createDefaultExecutionConfig(task: ProjectConfig["task"]): ProjectConfig["execution"] {
  return {
    canonicalRoot: DEFAULT_EXECUTION_ROOT,
    worktreeEnvVar: DEFAULT_WORKTREE_ENV_VAR,
    worktreeStrategy: DEFAULT_WORKTREE_STRATEGY,
    entrypoints: buildDefaultExecutionEntrypoints(task.command, task.tasks)
  };
}

function normalizeExecutionConfig(
  currentExecution: ProjectConfig["execution"] | undefined,
  task: ProjectConfig["task"]
): ProjectConfig["execution"] {
  const defaults = createDefaultExecutionConfig(task);

  return {
    canonicalRoot: currentExecution?.canonicalRoot?.trim() || defaults.canonicalRoot,
    worktreeEnvVar: currentExecution?.worktreeEnvVar?.trim() || defaults.worktreeEnvVar,
    worktreeStrategy: currentExecution?.worktreeStrategy === "overlay" ? "overlay" : defaults.worktreeStrategy,
    entrypoints: normalizeExecutionEntrypoints(currentExecution?.entrypoints, task)
  };
}

function normalizeExecutionEntrypoints(
  currentEntrypoints: ProjectConfig["execution"]["entrypoints"] | undefined,
  task: ProjectConfig["task"]
): ProjectConfig["execution"]["entrypoints"] {
  return {
    build: normalizeExecutionEntrypoint(currentEntrypoints?.build, task.command, task.tasks.build),
    test: normalizeExecutionEntrypoint(currentEntrypoints?.test, task.command, task.tasks.test),
    lint: normalizeExecutionEntrypoint(currentEntrypoints?.lint, task.command, task.tasks.lint),
    verify: normalizeExecutionEntrypoint(currentEntrypoints?.verify, task.command, task.tasks.verify),
    review: normalizeExecutionEntrypoint(currentEntrypoints?.review, task.command, task.tasks.review)
  };
}

function normalizeExecutionEntrypoint(
  currentEntrypoint: string | undefined,
  taskCommand: string,
  taskName: string
): string {
  const defaultEntrypoint = buildTaskEntrypoint(taskCommand, taskName);
  const legacyEntrypoints = [buildTaskEntrypoint("task", taskName), buildTaskEntrypoint("go-task", taskName)];

  if (!currentEntrypoint || currentEntrypoint === defaultEntrypoint || legacyEntrypoints.includes(currentEntrypoint)) {
    return defaultEntrypoint;
  }

  return currentEntrypoint;
}

function buildDefaultExecutionEntrypoints(
  taskCommand: string,
  taskNames: ProjectConfig["task"]["tasks"]
): ProjectConfig["execution"]["entrypoints"] {
  return {
    build: buildTaskEntrypoint(taskCommand, taskNames.build),
    test: buildTaskEntrypoint(taskCommand, taskNames.test),
    lint: buildTaskEntrypoint(taskCommand, taskNames.lint),
    verify: buildTaskEntrypoint(taskCommand, taskNames.verify),
    review: buildTaskEntrypoint(taskCommand, taskNames.review)
  };
}

function buildTaskEntrypoint(taskCommand: string, taskName: string): string {
  return `${taskCommand} ${taskName}`;
}

function normalizeTaskCommands(
  currentCommands: ProjectConfig["commands"] | undefined,
  profileTaskCommands: ProjectConfig["commands"],
  taskCommand: string
): ProjectConfig["commands"] {
  return {
    build: normalizeTaskCommandList(currentCommands?.build, profileTaskCommands.build, taskCommand),
    test: normalizeTaskCommandList(currentCommands?.test, profileTaskCommands.test, taskCommand),
    lint: normalizeTaskCommandList(currentCommands?.lint, profileTaskCommands.lint, taskCommand),
    verify: normalizeTaskCommandList(currentCommands?.verify, profileTaskCommands.verify, taskCommand),
    review: normalizeTaskCommandList(currentCommands?.review, profileTaskCommands.review, taskCommand)
  };
}

function normalizeTaskCommandList(
  currentCommands: string[] | undefined,
  profileCommands: string[],
  taskCommand: string
): string[] {
  const currentDefault = renderTaskCommands(
    {
      build: profileCommands,
      test: profileCommands,
      lint: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    taskCommand
  ).build;
  const legacyTask = renderTaskCommands(
    {
      build: profileCommands,
      test: profileCommands,
      lint: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    "task"
  ).build;
  const legacyGoTask = renderTaskCommands(
    {
      build: profileCommands,
      test: profileCommands,
      lint: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    "go-task"
  ).build;

  if (
    !currentCommands ||
    areStringArraysEqual(currentCommands, profileCommands) ||
    areStringArraysEqual(currentCommands, legacyTask) ||
    areStringArraysEqual(currentCommands, legacyGoTask) ||
    areStringArraysEqual(currentCommands, currentDefault)
  ) {
    return currentDefault;
  }

  return currentCommands;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function mergeManagedSurfaces(
  current: ProjectConfig["managedSurfaces"] | undefined,
  defaults: ProjectConfig["managedSurfaces"]
): ProjectConfig["managedSurfaces"] {
  const existing = Array.isArray(current) ? current : [];
  const seen = new Set(existing.map((entry) => entry.path));
  return [...existing, ...defaults.filter((entry) => !seen.has(entry.path))];
}
