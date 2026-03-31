import path from "node:path";

import YAML from "yaml";

import { ensureDir, readTextFileIfExists, writeTextFile } from "./filesystem.js";
import { getProfileDefinition } from "./profiles/definitions.js";
import type { DetectionResult, ProjectConfig, ProjectProfileId } from "./types.js";

export const CONFIG_FILE_NAME = "ai.config.yaml";
export const MACHINE_MANIFEST_PATH = path.join(".agents", "project.manifest.json");

export function createConfig(params: {
  repoRoot: string;
  projectSlug: string;
  projectName: string;
  profileId: ProjectProfileId;
  detectionResult?: DetectionResult;
}): ProjectConfig {
  const profile = getProfileDefinition(params.profileId);

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
      language: profile.languageDefault
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
    runtimes: {
      cursor: true,
      codex: true,
      agent: true,
      agents: true
    },
    task: {
      command: "task",
      tasks: {
        build: "build",
        test: "test",
        lint: "lint",
        verify: "verify",
        review: "review"
      }
    },
    commands: profile.taskCommands,
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
      { path: ".ai", policy: "managed" },
      { path: "AGENTS.md", policy: "managed" },
      { path: "MANIFESTO.md", policy: "managed" },
      { path: "Taskfile.yml", policy: "managed" },
      { path: "llms.txt", policy: "managed" },
      { path: "llms", policy: "managed" },
      { path: ".cursor", policy: "managed" },
      { path: ".codex", policy: "managed" },
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
  const manifestPath = path.join(repoRoot, MACHINE_MANIFEST_PATH);
  ensureDir(path.dirname(manifestPath));
  writeTextFile(manifestPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return configPath;
}

export function buildCopierAnswers(config: ProjectConfig): Record<string, unknown> {
  return {
    project_slug: config.project.slug,
    project_name: config.project.name,
    main_branch: config.project.mainBranch,
    workflow_tracker: config.workflow.tracker,
    workflow_language: config.workflow.language,
    linear_enabled: config.linear.enabled,
    linear_require_tracker: config.linear.requireTrackerForIssueFlow,
    linear_scopes: config.linear.scopes,
    profile_id: config.profile.id,
    enable_cursor: config.runtimes.cursor,
    enable_codex: config.runtimes.codex,
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

export function applyProfileToConfig(config: ProjectConfig, profileId: ProjectProfileId): ProjectConfig {
  const profile = getProfileDefinition(profileId);
  return {
    ...config,
    profile: {
      ...config.profile,
      id: profileId
    },
    workflow: {
      ...config.workflow,
      tracker: profile.trackerDefault,
      language: profile.languageDefault
    },
    linear: {
      enabled: profile.linearDefaults.enabled,
      requireTrackerForIssueFlow: profile.trackerDefault === "linear",
      scopes: profile.linearDefaults.scopes
    },
    commands: profile.taskCommands,
    manifesto: {
      ...config.manifesto,
      title: profile.manifestoTitle
    },
    llms: {
      ...config.llms,
      sourceGlobs: profile.llmsSourceGlobs
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

  return {
    ...defaults,
    ...config,
    project: {
      ...defaults.project,
      ...config.project
    },
    workflow: {
      ...defaults.workflow,
      ...config.workflow
    },
    linear: {
      ...defaults.linear,
      ...config.linear
    },
    profile: {
      ...defaults.profile,
      ...config.profile
    },
    runtimes: {
      ...defaults.runtimes,
      ...config.runtimes
    },
    task: {
      ...defaults.task,
      ...config.task,
      tasks: {
        ...defaults.task.tasks,
        ...config.task?.tasks
      }
    },
    commands: {
      ...defaults.commands,
      ...config.commands
    },
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

function mergeManagedSurfaces(
  current: ProjectConfig["managedSurfaces"] | undefined,
  defaults: ProjectConfig["managedSurfaces"]
): ProjectConfig["managedSurfaces"] {
  const existing = Array.isArray(current) ? current : [];
  const seen = new Set(existing.map((entry) => entry.path));
  return [...existing, ...defaults.filter((entry) => !seen.has(entry.path))];
}
