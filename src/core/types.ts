export type ProjectProfileId =
  | "python-fastapi-docker"
  | "laravel-docker"
  | "vue-quasar-capacitor";

export type TrackerType = "linear" | "gitlab" | "github" | "none";

export interface LinearScope {
  teamId: string | null;
  team: string | null;
  projectId: string | null;
  project: string | null;
  defaultLabels: string[];
}

export interface TaskCommands {
  build: string[];
  test: string[];
  lint: string[];
  verify: string[];
  review: string[];
}

export interface RuntimeFlags {
  cursor: boolean;
  codex: boolean;
  claude: boolean;
  agent: boolean;
  agents: boolean;
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
  };
  /** Local PLAN:: / PROGRESS:: mirror layout; per-issue files live under `{planProgressRoot}/{ISSUE-ID}/`. */
  artifacts: {
    planProgressRoot: string;
  };
  runtimes: RuntimeFlags;
  task: {
    command: string;
    tasks: {
      build: string;
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
  agents?: {
    markdown?: string;
  };
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
