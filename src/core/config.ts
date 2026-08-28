import path from "node:path";

import YAML from "yaml";

import {
  DEFAULT_AGENT_MODEL_TIERS,
  normalizeAgentsConfig,
  writeModelProfilesManifest
} from "./agent-models.js";
import { AGENT_RUNTIME_IDS, isAgentRuntimeId, validateModelSlugForRuntime } from "./active-runtime.js";
import { ensureDir, readTextFileIfExists, writeTextFile } from "./filesystem.js";
import { ensureInstallerState } from "./state.js";
import { getProfileDefinition } from "./profiles/definitions.js";
import { applyLocalConfig, loadLocalConfig } from "./local-config.js";
import { DEFAULT_TASK_COMMAND, renderTaskCommands } from "./task-runner.js";
import { AIFORGE_VERSION } from "./version.js";
import type {
  DetectionResult,
  MinimalismLevel,
  MinimalismReviewGate,
  OrchestratorAuditGate,
  OrchestratorSimplifyGate,
  ProjectConfig,
  ProjectProfileId
} from "./types.js";

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
      implement: "implement",
      test: "test",
      testScoped: "test-scoped",
      lint: "lint",
      lintScoped: "lint-scoped",
      verify: "verify",
      review: "review"
    }
  };

  const features = {
    mcp: true,
    llms: false,
    manifesto: true
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
      phases: ["issue", "plan", "implement", "review", "test"],
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
      maxReviewIterations: 1,
      auditGate: "never",
      simplifyGate: "never"
    },
    minimalism: {
      enabled: true,
      level: "full",
      reviewGate: "never"
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
      markdown: "",
      modelTiers: { ...DEFAULT_AGENT_MODEL_TIERS },
      runtimeModels: {
        codex: {
          quality: "gpt-5.6-sol",
          balanced: "gpt-5.6-terra",
          budget: "gpt-5.6-luna"
        }
      }
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
      { path: ".aiforge-version", policy: "managed" },
      { path: ".aiforge.json", policy: "managed" },
      { path: ".ai/project.model-profiles.json", policy: "managed" },
      { path: ".ai", policy: "managed" },
      { path: "AGENTS.md", policy: "managed" },
      { path: "MANIFESTO.md", policy: "managed" },
      { path: "Taskfile.yml", policy: "managed" },
      { path: ".cursor", policy: "managed" },
      { path: ".codex", policy: "managed" },
      { path: ".claude", policy: "managed" },
      { path: ".agent", policy: "managed" },
      { path: ".agents", policy: "managed" },
      { path: "openspec", policy: "semi-managed" }
    ],
    updatePolicy: "strict",
    features
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

/** Load committed project truth plus the narrow, ignored machine/user overlay. */
export function loadEffectiveConfig(repoRoot: string): ProjectConfig {
  const effective = applyLocalConfig(loadConfig(repoRoot), loadLocalConfig(repoRoot));
  const normalized = normalizeConfig(effective);
  validateConfig(normalized);
  return normalized;
}

export function saveConfig(repoRoot: string, config: ProjectConfig): string {
  const normalized = normalizeConfig(config);
  validateConfig(normalized);
  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  writeTextFile(configPath, YAML.stringify(normalized));
  writeMachineManifest(repoRoot, applyLocalConfig(normalized, loadLocalConfig(repoRoot)));
  return configPath;
}

export function writeMachineManifest(repoRoot: string, config: ProjectConfig): string {
  const normalized = normalizeConfig(config);
  validateConfig(normalized);
  const manifestPath = path.join(repoRoot, MACHINE_MANIFEST_PATH);
  ensureDir(path.dirname(manifestPath));
  writeTextFile(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`);
  ensureInstallerState(repoRoot, normalized);
  writeModelProfilesManifest(repoRoot, normalized);
  return manifestPath;
}

export function buildCopierAnswers(config: ProjectConfig): Record<string, unknown> {
  return {
    aiforge_version: AIFORGE_VERSION,
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
    orchestrator_audit_gate: config.orchestrator.auditGate,
    orchestrator_simplify_gate: config.orchestrator.simplifyGate,
    minimalism_enabled: config.minimalism.enabled,
    minimalism_level: config.minimalism.level,
    minimalism_review_gate: config.minimalism.reviewGate,
    execution_canonical_root: config.execution.canonicalRoot,
    execution_worktree_env_var: config.execution.worktreeEnvVar,
    execution_worktree_strategy: config.execution.worktreeStrategy,
    execution_implement_entrypoint: config.execution.entrypoints.implement,
    execution_test_entrypoint: config.execution.entrypoints.test,
    execution_test_scoped_entrypoint: config.execution.entrypoints.testScoped,
    execution_lint_entrypoint: config.execution.entrypoints.lint,
    execution_lint_scoped_entrypoint: config.execution.entrypoints.lintScoped,
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
    task_implement_name: config.task.tasks.implement,
    task_test_name: config.task.tasks.test,
    task_test_scoped_name: config.task.tasks.testScoped,
    task_lint_name: config.task.tasks.lint,
    task_lint_scoped_name: config.task.tasks.lintScoped,
    task_verify_name: config.task.tasks.verify,
    task_review_name: config.task.tasks.review,
    commands: config.commands,
    profile_notes: getProfileDefinition(config.profile.id).notes,
    mcp_placeholders: config.mcp.placeholders,
    project_rules_markdown: config.projectRules?.markdown ?? "",
    agents_markdown: config.agents?.markdown ?? "",
    agent_model_orchestrator: config.agents.modelTiers.orchestrator,
    agent_model_plan: config.agents.modelTiers.plan,
    agent_model_skeptic: config.agents.modelTiers.skeptic,
    agent_model_clarify: config.agents.modelTiers.clarify,
    agent_model_implement: config.agents.modelTiers.implement,
    agent_model_review: config.agents.modelTiers.review,
    agent_model_audit: config.agents.modelTiers.audit,
    agent_model_simplify_review: config.agents.modelTiers.simplifyReview,
    agent_model_tracker: config.agents.modelTiers.tracker,
    agent_runtime_models_json: JSON.stringify(config.agents.runtimeModels ?? {}, null, 2)
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

  if (!["never", "process-layer-only", "always"].includes(config.orchestrator.auditGate ?? "")) {
    throw new Error(
      "Config orchestrator.auditGate must be one of: never, process-layer-only, always"
    );
  }

  if (!["never", "optional", "always"].includes(config.orchestrator.simplifyGate ?? "")) {
    throw new Error(
      "Config orchestrator.simplifyGate must be one of: never, optional, always"
    );
  }

  if (typeof config.minimalism?.enabled !== "boolean") {
    throw new Error("Config minimalism.enabled must be a boolean");
  }

  if (!["lite", "full", "ultra", "off"].includes(config.minimalism?.level ?? "")) {
    throw new Error("Config minimalism.level must be one of: lite, full, ultra, off");
  }

  if (!["never", "optional", "before-review"].includes(config.minimalism?.reviewGate ?? "")) {
    throw new Error(
      "Config minimalism.reviewGate must be one of: never, optional, before-review"
    );
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
    !config.execution?.entrypoints?.implement?.trim() ||
    !config.execution?.entrypoints?.test?.trim() ||
    !config.execution?.entrypoints?.testScoped?.trim() ||
    !config.execution?.entrypoints?.lint?.trim() ||
    !config.execution?.entrypoints?.lintScoped?.trim() ||
    !config.execution?.entrypoints?.verify?.trim() ||
    !config.execution?.entrypoints?.review?.trim()
  ) {
    throw new Error("Config execution.entrypoints.{implement,test,testScoped,lint,lintScoped,verify,review} are required");
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

  if (!config.agents || typeof config.agents !== "object") {
    throw new Error("Config agents is required");
  }

  if (config.agents.markdown !== undefined && typeof config.agents.markdown !== "string") {
    throw new Error("Config agents.markdown must be a string when provided");
  }

  for (const [role, tier] of Object.entries(config.agents.modelTiers)) {
    if (!["quality", "balanced", "budget"].includes(tier)) {
      throw new Error(`Config agents.modelTiers.${role} must be quality, balanced, or budget`);
    }
  }

  if (config.agents.runtimeModels) {
    for (const [runtime, hints] of Object.entries(config.agents.runtimeModels)) {
      if (!isAgentRuntimeId(runtime)) {
        throw new Error(
          `Config agents.runtimeModels.${runtime} is unknown; expected one of: ${AGENT_RUNTIME_IDS.join(", ")}`
        );
      }
      for (const [tier, slug] of Object.entries(hints ?? {})) {
        const { rejectedReason } = validateModelSlugForRuntime(runtime, slug);
        if (rejectedReason && slug && rejectedReason !== "reserved-ui-mode") {
          throw new Error(`Config agents.runtimeModels.${runtime}.${tier}: ${rejectedReason}`);
        }
      }
    }
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
  const profileDefaults = createConfig({
    repoRoot: "",
    projectSlug: config.project?.slug ?? "project",
    projectName: config.project?.name ?? "Project",
    profileId
  });
  const task = normalizeTaskConfig(config.task, profileDefaults.task, taskCommand);
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
    agents: normalizeAgentsConfig(config.agents, profileDefaults.agents),
    llms: {
      ...config.llms,
      sourceGlobs
    },
    projectRules: {
      ...config.projectRules
    }
  };
}

function normalizeOrchestratorSimplifyGate(value: string | undefined): OrchestratorSimplifyGate {
  if (value === "always" || value === "optional" || value === "never") {
    return value;
  }

  return "never";
}

function normalizeMinimalismLevel(value: string | undefined): MinimalismLevel {
  if (value === "lite" || value === "full" || value === "ultra" || value === "off") {
    return value;
  }

  return "full";
}

function normalizeMinimalismReviewGate(value: string | undefined): MinimalismReviewGate {
  if (value === "never" || value === "optional" || value === "before-review") {
    return value;
  }

  return "never";
}

function normalizeMinimalismConfig(
  current: ProjectConfig["minimalism"] | undefined,
  defaults: ProjectConfig["minimalism"]
): ProjectConfig["minimalism"] {
  const enabled = current?.enabled ?? defaults.enabled;
  return {
    enabled,
    level: enabled ? normalizeMinimalismLevel(current?.level) : "off",
    reviewGate: enabled
      ? normalizeMinimalismReviewGate(current?.reviewGate)
      : normalizeMinimalismReviewGate("never")
  };
}

function normalizeOrchestratorAuditGate(value: string | undefined): OrchestratorAuditGate {
  if (value === "always" || value === "process-layer-only" || value === "never") {
    return value;
  }

  return "never";
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
  const task = normalizeTaskConfig(config.task, defaults.task, taskCommand);
  const features = {
    ...defaults.features,
    ...config.features
  };
  const managedSurfaces = mergeManagedSurfaces(config.managedSurfaces, defaults.managedSurfaces);

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
      phases: normalizeWorkflowPhases(config.workflow?.phases ?? defaults.workflow.phases),
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
      ...config.orchestrator,
      auditGate: normalizeOrchestratorAuditGate(config.orchestrator?.auditGate),
      simplifyGate: normalizeOrchestratorSimplifyGate(config.orchestrator?.simplifyGate)
    },
    minimalism: normalizeMinimalismConfig(config.minimalism, defaults.minimalism),
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
    agents: normalizeAgentsConfig(config.agents, defaults.agents),
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
    managedSurfaces: features.llms
      ? managedSurfaces
      : managedSurfaces.filter((entry) => entry.path !== "llms.txt" && entry.path !== "llms"),
    features
  };
}

function normalizeTaskCommand(taskCommand: string | undefined): string {
  if (!taskCommand || taskCommand === "task" || taskCommand === "go-task") {
    return DEFAULT_TASK_COMMAND;
  }

  return taskCommand;
}

function normalizeWorkflowPhases(phases: string[]): string[] {
  return phases.map((phase) => (phase === "build" ? "implement" : phase));
}

function normalizeTaskConfig(
  currentTask: ProjectConfig["task"] | undefined,
  defaultTask: ProjectConfig["task"],
  taskCommand: string
): ProjectConfig["task"] {
  const currentTasks = currentTask?.tasks as
    | (Partial<ProjectConfig["task"]["tasks"]> & { build?: string })
    | undefined;

  return {
    command: taskCommand,
    tasks: {
      implement: currentTasks?.implement ?? normalizeLegacyBuildTaskName(currentTasks?.build, defaultTask.tasks.implement),
      test: currentTasks?.test ?? defaultTask.tasks.test,
      testScoped: currentTasks?.testScoped ?? defaultTask.tasks.testScoped,
      lint: currentTasks?.lint ?? defaultTask.tasks.lint,
      lintScoped: currentTasks?.lintScoped ?? defaultTask.tasks.lintScoped,
      verify: currentTasks?.verify ?? defaultTask.tasks.verify,
      review: currentTasks?.review ?? defaultTask.tasks.review
    }
  };
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
  const legacyEntrypoints = currentEntrypoints as
    | (Partial<ProjectConfig["execution"]["entrypoints"]> & { build?: string })
    | undefined;

  return {
    implement: normalizeExecutionEntrypoint(
      currentEntrypoints?.implement ??
        normalizeLegacyBuildEntrypoint(legacyEntrypoints?.build, task.command, task.tasks.implement),
      task.command,
      task.tasks.implement
    ),
    test: normalizeExecutionEntrypoint(currentEntrypoints?.test, task.command, task.tasks.test),
    testScoped: normalizeExecutionEntrypoint(currentEntrypoints?.testScoped, task.command, task.tasks.testScoped),
    lint: normalizeExecutionEntrypoint(currentEntrypoints?.lint, task.command, task.tasks.lint),
    lintScoped: normalizeExecutionEntrypoint(currentEntrypoints?.lintScoped, task.command, task.tasks.lintScoped),
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
    implement: buildTaskEntrypoint(taskCommand, taskNames.implement),
    test: buildTaskEntrypoint(taskCommand, taskNames.test),
    testScoped: buildTaskEntrypoint(taskCommand, taskNames.testScoped),
    lint: buildTaskEntrypoint(taskCommand, taskNames.lint),
    lintScoped: buildTaskEntrypoint(taskCommand, taskNames.lintScoped),
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
  const legacyCommands = currentCommands as (Partial<ProjectConfig["commands"]> & { build?: string[] }) | undefined;

  return {
    implement: normalizeTaskCommandList(
      currentCommands?.implement ?? legacyCommands?.build,
      profileTaskCommands.implement,
      taskCommand
    ),
    test: normalizeTaskCommandList(currentCommands?.test, profileTaskCommands.test, taskCommand),
    testScoped: normalizeTaskCommandList(currentCommands?.testScoped, profileTaskCommands.testScoped, taskCommand),
    lint: normalizeTaskCommandList(currentCommands?.lint, profileTaskCommands.lint, taskCommand),
    lintScoped: normalizeTaskCommandList(currentCommands?.lintScoped, profileTaskCommands.lintScoped, taskCommand),
    verify: normalizeTaskCommandList(currentCommands?.verify, profileTaskCommands.verify, taskCommand),
    review: normalizeReviewCommandList(currentCommands?.review, profileTaskCommands.review, taskCommand)
  };
}

function normalizeReviewCommandList(
  currentCommands: string[] | undefined,
  profileCommands: string[],
  taskCommand: string
): string[] {
  const retiredNestedVerify = new Set([
    `${taskCommand} verify`,
    `${DEFAULT_TASK_COMMAND} verify`,
    "task verify",
    "go-task verify"
  ]);
  const withoutNestedVerify = currentCommands?.filter(
    (command) => !retiredNestedVerify.has(command.trim())
  );
  return normalizeTaskCommandList(
    withoutNestedVerify && withoutNestedVerify.length > 0 ? withoutNestedVerify : undefined,
    profileCommands,
    taskCommand
  );
}

function normalizeLegacyBuildTaskName(taskName: string | undefined, defaultImplementTaskName: string): string {
  if (!taskName || taskName === "build") {
    return defaultImplementTaskName;
  }

  return taskName;
}

function normalizeLegacyBuildEntrypoint(
  entrypoint: string | undefined,
  taskCommand: string,
  implementTaskName: string
): string | undefined {
  const legacyBuildEntrypoints = [
    buildTaskEntrypoint(taskCommand, "build"),
    buildTaskEntrypoint("task", "build"),
    buildTaskEntrypoint("go-task", "build"),
    buildTaskEntrypoint(DEFAULT_TASK_COMMAND, "build")
  ];

  if (!entrypoint || legacyBuildEntrypoints.includes(entrypoint)) {
    return undefined;
  }

  return entrypoint;
}

function normalizeTaskCommandList(
  currentCommands: string[] | undefined,
  profileCommands: string[],
  taskCommand: string
): string[] {
  const currentDefault = renderTaskCommands(
    {
      implement: profileCommands,
      test: profileCommands,
      testScoped: profileCommands,
      lint: profileCommands,
      lintScoped: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    taskCommand
  ).implement;
  const legacyTask = renderTaskCommands(
    {
      implement: profileCommands,
      test: profileCommands,
      testScoped: profileCommands,
      lint: profileCommands,
      lintScoped: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    "task"
  ).implement;
  const legacyGoTask = renderTaskCommands(
    {
      implement: profileCommands,
      test: profileCommands,
      testScoped: profileCommands,
      lint: profileCommands,
      lintScoped: profileCommands,
      verify: profileCommands,
      review: profileCommands
    },
    "go-task"
  ).implement;

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
