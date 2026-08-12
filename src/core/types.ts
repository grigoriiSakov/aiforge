export type ProjectProfileId =
  | "python-fastapi-docker"
  | "python-django"
  | "laravel-docker"
  | "node-express-api"
  | "nextjs"
  | "react-vite"
  | "vue-quasar-capacitor"
  | "go-service";

export type TrackerType = "linear" | "gitlab" | "github" | "none";

export interface LinearScope {
  teamId: string | null;
  team: string | null;
  projectId: string | null;
  project: string | null;
  defaultLabels: string[];
}

export interface TaskCommands {
  implement: string[];
  test: string[];
  lint: string[];
  verify: string[];
  review: string[];
}

export type WorktreeExecutionStrategy = "direct" | "overlay";

/** When the orchestrator runs a separate /audit subagent alongside /review. */
export type OrchestratorAuditGate = "never" | "process-layer-only" | "always";

/** When the orchestrator runs a separate /simplify-review subagent before /review. */
export type OrchestratorSimplifyGate = "never" | "optional" | "always";

export type MinimalismLevel = "lite" | "full" | "ultra" | "off";

/** Standalone /review complexity pass policy when minimalism is enabled. */
export type MinimalismReviewGate = "never" | "optional" | "before-review";

export interface MinimalismConfig {
  enabled: boolean;
  level: MinimalismLevel;
  reviewGate: MinimalismReviewGate;
}

export interface ExecutionEntrypoints {
  implement: string;
  test: string;
  lint: string;
  verify: string;
  review: string;
}

export interface RuntimeFlags {
  cursor: boolean;
  codex: boolean;
  claude: boolean;
  agent: boolean;
  agents: boolean;
}

/** Runtime-agnostic cost/quality knob; map to concrete model IDs per IDE in `agents.runtimeModels`. */
export type AgentModelTier = "quality" | "balanced" | "budget";

export type AgentModelRole =
  | "orchestrator"
  | "plan"
  | "skeptic"
  | "clarify"
  | "implement"
  | "review"
  | "audit"
  | "simplifyReview"
  | "tracker";

export interface AgentModelTiers {
  orchestrator: AgentModelTier;
  plan: AgentModelTier;
  skeptic: AgentModelTier;
  clarify: AgentModelTier;
  implement: AgentModelTier;
  review: AgentModelTier;
  audit: AgentModelTier;
  simplifyReview: AgentModelTier;
  tracker: AgentModelTier;
}

export type RuntimeModelHints = Partial<Record<AgentModelTier, string>>;

export interface AgentsConfig {
  markdown?: string;
  modelTiers: AgentModelTiers;
  /** Optional per-runtime tier -> vendor model slug hints (skills read these; CLIs do not enforce). */
  runtimeModels?: Partial<Record<keyof RuntimeFlags, RuntimeModelHints>>;
}

/**
 * Developer/machine-specific overrides loaded from `.aiforge.local.yaml`.
 * Keep this intentionally narrow: project workflow truth and credentials do
 * not belong in the local overlay.
 */
export interface LocalProjectConfig {
  schemaVersion?: number;
  orchestrator?: {
    worktreeRoot?: string;
  };
  runtimes?: Partial<RuntimeFlags>;
  agents?: {
    runtimeModels?: Partial<Record<keyof RuntimeFlags, RuntimeModelHints>>;
  };
}

export interface ProjectConfig {
  schemaVersion: number;
  project: {
    slug: string;
    name: string;
    mainBranch: string;
  };
  workflow: {
    tracker: TrackerType;
    phases: string[];
    language: string;
    trackerStates: {
      planReady: string;
      active: string;
      review: string;
    };
  };
  linear: {
    enabled: boolean;
    requireTrackerForIssueFlow: boolean;
    scopes: LinearScope[];
  };
  profile: {
    id: ProjectProfileId;
    detectedFrom?: string[];
  };
  orchestrator: {
    worktreeRoot: string;
    branchPrefix: string;
    maxReviewIterations: number;
    auditGate: OrchestratorAuditGate;
    simplifyGate: OrchestratorSimplifyGate;
  };
  minimalism: MinimalismConfig;
  execution: {
    canonicalRoot: string;
    worktreeEnvVar: string;
    worktreeStrategy: WorktreeExecutionStrategy;
    entrypoints: ExecutionEntrypoints;
  };
  /** Local PLAN:: / PROGRESS:: artifact layout; per-issue files live under `{planProgressRoot}/{ISSUE-ID}/`. */
  artifacts: {
    planProgressRoot: string;
  };
  runtimes: RuntimeFlags;
  task: {
    command: string;
    tasks: {
      implement: string;
      test: string;
      lint: string;
      verify: string;
      review: string;
    };
  };
  commands: TaskCommands;
  manifesto: {
    path: string;
    title: string;
    markdown?: string;
  };
  agents: AgentsConfig;
  llms: {
    rootDir: string;
    txtPath: string;
    sourceGlobs: string[];
  };
  mcp: {
    scaffold: boolean;
    placeholders: string[];
  };
  projectRules?: {
    markdown?: string;
  };
  managedSurfaces: Array<{
    path: string;
    policy: "managed" | "semi-managed" | "unmanaged";
  }>;
  updatePolicy: "strict" | "preserve-local-overrides" | "report-only";
  features: {
    mcp: boolean;
    llms: boolean;
    manifesto: boolean;
  };
}

export interface ProfileDefinition {
  id: ProjectProfileId;
  label: string;
  detectionHints: string[];
  taskCommands: TaskCommands;
  trackerDefault: TrackerType;
  languageDefault: string;
  linearDefaults: {
    enabled: boolean;
    scopes: LinearScope[];
  };
  manifestoTitle: string;
  llmsSourceGlobs: string[];
  notes: string[];
}

export interface DetectionResult {
  recommendedProfile: ProjectProfileId;
  confidence: "high" | "medium" | "low";
  score: number;
  reasons: string[];
  facts: string[];
}

export interface CommandResult {
  ok: boolean;
  code: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface CopierRunOptions {
  templatePath: string;
  destinationPath: string;
  dataFilePath: string;
  dryRun?: boolean;
  force?: boolean;
  trust?: boolean;
}
