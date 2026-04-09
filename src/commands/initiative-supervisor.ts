import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { spawn, spawnSync } from "node:child_process";

import type { CommandResult } from "../core/types.js";

const SUPERVISOR_RUNTIME_RELATIVE_PATH = path.join(".ai", "runtime", "initiative-supervisor-state.mjs");
const SUPERVISOR_RUNS_DIR = path.join(".ai", "runtime", "initiative-supervisor", "runs");

type SupervisorState = {
  slug: string;
  status: string;
  manifestPath?: string;
  managerBranch?: string;
  currentIssueId?: string | null;
  runner?: {
    provider?: string;
    commandTemplate?: string | null;
    detectedProvider?: string | null;
  };
};

type BootstrapIssue = {
  id: string;
  title: string;
  team?: string;
  order: number;
  blockedBy: string[];
};

type InitiativeSupervisorInitOptions = {
  slug: string;
  manifest?: string;
  baseBranch?: string;
  managerBranch?: string;
  maxAttempts?: number;
  project?: string;
  projectId?: string;
  tracker?: string;
  teams?: string[];
  issueIds?: string[];
  runnerProvider?: string;
  runnerCommand?: string;
  bootstrapIssues?: BootstrapIssue[];
};

type InteractiveInitOptions = Partial<Omit<InitiativeSupervisorInitOptions, "slug">> & {
  slug?: string;
  start?: boolean;
};

type PromptSession = {
  question(query: string): Promise<string>;
  close(): void;
};

function runtimePath(repoRoot: string): string {
  return path.join(repoRoot, SUPERVISOR_RUNTIME_RELATIVE_PATH);
}

function runStatePath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, SUPERVISOR_RUNS_DIR, `${slug}.json`);
}

function defaultManifestPath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, ".ai", "context", "initiatives", slug, "issues-manifest.json");
}

function defaultManagerBranch(slug: string): string {
  return `initiative/${slug}`;
}

function currentGitBranch(repoRoot: string): string | null {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  const value = result.stdout.trim();
  return value || null;
}

function splitCommaList(raw: string): string[] {
  return String(raw)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBootstrapIssueLine(line: string, index: number): BootstrapIssue {
  const parts = line
    .split("|")
    .map((part) => part.trim())
    .filter((part, partIndex) => part !== "" || partIndex < 3);

  if (parts.length < 2) {
    throw new Error(
      `Invalid issue entry "${line}". Use "ISSUE-ID | team | title | blockedBy1,blockedBy2" or "ISSUE-ID | title".`
    );
  }

  const id = parts[0] ?? "";
  if (!id) {
    throw new Error(`Invalid issue entry "${line}": missing issue id.`);
  }

  if (parts.length === 2) {
    return {
      id,
      title: parts[1] ?? "",
      order: (index + 1) * 10,
      blockedBy: []
    };
  }

  const team = parts[1] || undefined;
  const title = parts[2] ?? "";
  if (!title) {
    throw new Error(`Invalid issue entry "${line}": missing title.`);
  }

  return {
    id,
    title,
    ...(team ? { team } : {}),
    order: (index + 1) * 10,
    blockedBy: splitCommaList(parts.slice(3).join("|"))
  };
}

function buildBootstrapManifest(repoRoot: string, options: InitiativeSupervisorInitOptions): Record<string, unknown> {
  const artifactsRoot = path.join(".ai", "context", "initiatives", options.slug);
  const project: Record<string, unknown> = {};
  if (options.project) {
    project.project = options.project;
  }
  if (options.projectId) {
    project.projectId = options.projectId;
  }
  if (options.tracker) {
    project.tracker = options.tracker;
  }

  return {
    version: 1,
    slug: options.slug,
    baseBranch: options.baseBranch ?? currentGitBranch(repoRoot) ?? "main",
    managerBranch: options.managerBranch ?? defaultManagerBranch(options.slug),
    maxAttemptsPerIssue: options.maxAttempts ?? 3,
    artifacts: {
      prd: path.join(artifactsRoot, "prd.md"),
      technicalSpec: path.join(artifactsRoot, "technical-spec.md"),
      executionMap: path.join(artifactsRoot, "execution-map.md")
    },
    ...(Object.keys(project).length > 0 ? { project } : {}),
    issues: (options.bootstrapIssues ?? []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      ...(issue.team ? { team: issue.team } : {}),
      order: issue.order,
      blockedBy: issue.blockedBy
    }))
  };
}

function requireRuntime(repoRoot: string): string {
  const targetPath = runtimePath(repoRoot);
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `Missing ${SUPERVISOR_RUNTIME_RELATIVE_PATH}. Run aiforge sync/init in the target repo before using initiative-supervisor.`
    );
  }
  return targetPath;
}

function readExistingState(repoRoot: string, slug: string): SupervisorState | null {
  const targetPath = runStatePath(repoRoot, slug);
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(targetPath, "utf8")) as SupervisorState;
}

function ensureManifest(repoRoot: string, options: InitiativeSupervisorInitOptions): {
  manifestPath: string;
  manifest: Record<string, unknown>;
  created: boolean;
} {
  const manifestPath = path.resolve(options.manifest ? options.manifest : defaultManifestPath(repoRoot, options.slug));
  let created = false;
  let manifest: Record<string, unknown>;

  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  } else if ((options.bootstrapIssues?.length ?? 0) > 0) {
    manifest = buildBootstrapManifest(repoRoot, options);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    created = true;
  } else {
    throw new Error(
      `Missing initiative manifest: ${manifestPath}. Run \`aiforge initiative-supervisor init --slug ${options.slug} --interactive\` to bootstrap it, or pass --manifest.`
    );
  }

  if (options.baseBranch) {
    manifest.baseBranch = options.baseBranch;
  }
  if (options.managerBranch) {
    manifest.managerBranch = options.managerBranch;
  }
  if (typeof options.maxAttempts === "number") {
    manifest.maxAttemptsPerIssue = options.maxAttempts;
  }

  const project = isRecord(manifest.project) ? { ...manifest.project } : {};
  if (options.project) {
    project.project = options.project;
  }
  if (options.projectId) {
    project.projectId = options.projectId;
  }
  if (options.tracker) {
    project.tracker = options.tracker;
  }
  if (Object.keys(project).length > 0) {
    manifest.project = project;
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifestPath, manifest, created };
}

function invokeSupervisorRuntime(repoRoot: string, args: string[]): unknown {
  const targetPath = requireRuntime(repoRoot);
  const result = spawnSync("node", [targetPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `initiative-supervisor runtime failed: ${args.join(" ")}`);
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    return {};
  }

  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return { raw: stdout };
  }
}

function detectRuntimeProvider(): string | null {
  const explicit = process.env.AIFORGE_RUNTIME_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) {
    return "claude";
  }
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_AGENT) {
    return "cursor";
  }
  if (process.env.CODEX_SANDBOX || process.env.CODEX_ENV) {
    return "codex";
  }
  return null;
}

function resolveRunnerProvider(state: SupervisorState): string {
  const configured = String(state.runner?.provider ?? "auto").trim().toLowerCase();
  if (configured && configured !== "auto") {
    return configured;
  }
  return detectRuntimeProvider() ?? "manual";
}

function resolveRunnerCommandTemplate(state: SupervisorState, provider: string): string | null {
  const configured = typeof state.runner?.commandTemplate === "string" ? state.runner.commandTemplate.trim() : "";
  if (configured) {
    return configured;
  }
  const generic = process.env.AIFORGE_RUNNER_COMMAND?.trim();
  if (generic) {
    return generic;
  }
  const providerSpecific =
    process.env[`AIFORGE_${provider.toUpperCase()}_RUNNER_COMMAND`]?.trim() ??
    process.env[`AIFORGE_${provider.toUpperCase()}_COMMAND`]?.trim();
  return providerSpecific || null;
}

function renderRunnerCommand(
  template: string,
  params: {
    repoRoot: string;
    slug: string;
    issueId: string;
    promptPath: string;
    provider: string;
  }
): string {
  return template
    .replaceAll("{{repo_root}}", params.repoRoot)
    .replaceAll("{{slug}}", params.slug)
    .replaceAll("{{issue_id}}", params.issueId)
    .replaceAll("{{prompt_file}}", params.promptPath)
    .replaceAll("{{provider}}", params.provider);
}

function launchDetachedCommand(repoRoot: string, command: string): string {
  const runId = `worker-${Date.now()}`;
  const child = spawn("bash", ["-lc", command], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
  return `${runId}-${String(child.pid ?? "nopid")}`;
}

async function promptLine(
  rl: PromptSession,
  label: string,
  defaultValue?: string
): Promise<string> {
  const suffix = defaultValue && defaultValue.trim() ? ` [${defaultValue}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || (defaultValue ?? "");
}

async function promptRequiredLine(
  rl: PromptSession,
  label: string,
  defaultValue?: string
): Promise<string> {
  while (true) {
    const answer = await promptLine(rl, label, defaultValue);
    if (answer.trim()) {
      return answer.trim();
    }
  }
}

async function promptYesNo(
  rl: PromptSession,
  label: string,
  defaultValue: boolean
): Promise<boolean> {
  const suffix = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await rl.question(`${label} [${suffix}]: `)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (["y", "yes"].includes(answer)) {
      return true;
    }
    if (["n", "no"].includes(answer)) {
      return false;
    }
  }
}

async function promptIssueBootstrap(
  rl: PromptSession,
  output: NodeJS.WritableStream
): Promise<BootstrapIssue[]> {
  output.write(
    [
      "Paste ordered work issues one per line.",
      'Format: ISSUE-ID | team | title | blockedBy1,blockedBy2',
      'Short format also works: ISSUE-ID | title',
      "Submit an empty line to finish."
    ].join("\n") + "\n"
  );

  const issues: BootstrapIssue[] = [];
  while (true) {
    const line = (await rl.question("> ")).trim();
    if (!line) {
      break;
    }
    issues.push(parseBootstrapIssueLine(line, issues.length));
  }

  if (issues.length === 0) {
    throw new Error("Interactive manifest bootstrap aborted: at least one issue is required.");
  }

  return issues;
}

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

async function resolveInteractiveInitOptions(
  repoRoot: string,
  options: InteractiveInitOptions,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
  answers?: string[]
): Promise<{ init: InitiativeSupervisorInitOptions; start: boolean }> {
  const queuedAnswers = answers ? [...answers] : null;
  const rl: PromptSession = queuedAnswers
    ? {
        question: async () => queuedAnswers.shift() ?? "",
        close: () => {}
      }
    : createInterface({ input, output });

  try {
    output.write(`Initiative supervisor init wizard for ${repoRoot}\n`);

    const slug = await promptRequiredLine(rl, "Initiative slug", options.slug);
    const tracker = await promptLine(rl, "Tracker", options.tracker ?? "linear");
    const project = await promptLine(rl, "Project name", options.project);
    const projectId = await promptLine(rl, "Project id", options.projectId);
    const teamsRaw = await promptLine(
      rl,
      "Teams to include (comma-separated, blank = all)",
      (options.teams ?? []).join(",")
    );
    const issueIdsRaw = await promptLine(
      rl,
      "Explicit issue ids (comma-separated, blank = all selected by teams)",
      (options.issueIds ?? []).join(",")
    );
    const baseBranch = await promptLine(rl, "Base branch", options.baseBranch ?? currentGitBranch(repoRoot) ?? "main");
    const managerBranch = await promptLine(
      rl,
      "Manager branch",
      options.managerBranch ?? defaultManagerBranch(slug)
    );
    const runnerProvider = await promptLine(
      rl,
      "Runner provider",
      options.runnerProvider ?? detectRuntimeProvider() ?? "manual"
    );
    const runnerCommand = await promptLine(
      rl,
      "Runner command template (blank = manual launch fallback)",
      options.runnerCommand
    );
    const maxAttemptsRaw = await promptLine(rl, "Max attempts per issue", String(options.maxAttempts ?? 3));
    const manifestCandidate = path.resolve(options.manifest ? options.manifest : defaultManifestPath(repoRoot, slug));
    let bootstrapIssues: BootstrapIssue[] | undefined;

    if (!fs.existsSync(manifestCandidate) && !options.manifest) {
      const shouldBootstrap = await promptYesNo(
        rl,
        `No local initiative manifest found at ${manifestCandidate}. Bootstrap one now from pasted issues`,
        true
      );
      if (shouldBootstrap) {
        bootstrapIssues = await promptIssueBootstrap(rl, output);
      }
    }

    const shouldStart =
      typeof options.start === "boolean"
        ? options.start
        : await promptYesNo(rl, "Start supervisor immediately after init", true);
    const initOptions: InitiativeSupervisorInitOptions = { slug };
    const normalizedProject = normalizeOptional(project);
    const normalizedProjectId = normalizeOptional(projectId);
    const normalizedTracker = normalizeOptional(tracker);
    const selectedTeams = splitCommaList(teamsRaw);
    const selectedIssueIds = splitCommaList(issueIdsRaw);
    const normalizedBaseBranch = normalizeOptional(baseBranch);
    const normalizedManagerBranch = normalizeOptional(managerBranch);
    const normalizedRunnerProvider = normalizeOptional(runnerProvider);
    const normalizedRunnerCommand = normalizeOptional(runnerCommand);
    const parsedMaxAttempts = Number.parseInt(maxAttemptsRaw, 10);

    if (options.manifest) {
      initOptions.manifest = options.manifest;
    }
    if (normalizedProject) {
      initOptions.project = normalizedProject;
    }
    if (normalizedProjectId) {
      initOptions.projectId = normalizedProjectId;
    }
    if (normalizedTracker) {
      initOptions.tracker = normalizedTracker;
    }
    if (selectedTeams.length > 0) {
      initOptions.teams = selectedTeams;
    }
    if (selectedIssueIds.length > 0) {
      initOptions.issueIds = selectedIssueIds;
    }
    if (normalizedBaseBranch) {
      initOptions.baseBranch = normalizedBaseBranch;
    }
    if (normalizedManagerBranch) {
      initOptions.managerBranch = normalizedManagerBranch;
    }
    if (normalizedRunnerProvider) {
      initOptions.runnerProvider = normalizedRunnerProvider;
    }
    if (normalizedRunnerCommand) {
      initOptions.runnerCommand = normalizedRunnerCommand;
    }
    if (Number.isFinite(parsedMaxAttempts)) {
      initOptions.maxAttempts = parsedMaxAttempts;
    }
    if (bootstrapIssues) {
      initOptions.bootstrapIssues = bootstrapIssues;
    }

    return {
      init: initOptions,
      start: shouldStart
    };
  } finally {
    rl.close();
  }
}

export function runInitiativeSupervisorStartCommand(
  repoRoot: string,
  options: {
    slug: string;
  }
): CommandResult {
  const existing = readExistingState(repoRoot, options.slug);
  if (!existing) {
    throw new Error(
      `Initiative supervisor ${options.slug} is not initialized. Run \`aiforge initiative-supervisor init --slug ${options.slug}\` first.`
    );
  }

  if (existing.status === "paused") {
    const resumed = invokeSupervisorRuntime(repoRoot, ["resume", "--slug", options.slug]);
    const refreshed = readExistingState(repoRoot, options.slug) ?? existing;
    return continueInitiativeSupervisor(repoRoot, options.slug, refreshed, resumed as Record<string, unknown>);
  }

  if (existing.status === "running") {
    return continueInitiativeSupervisor(repoRoot, options.slug, existing, existing as Record<string, unknown>);
  }

  throw new Error(
    `Initiative supervisor ${options.slug} is in status ${existing.status}. Re-init or inspect status before starting.`
  );
}

export function runInitiativeSupervisorInitCommand(
  repoRoot: string,
  options: InitiativeSupervisorInitOptions
): CommandResult {
  const existing = readExistingState(repoRoot, options.slug);
  if (existing) {
    return {
      ok: true,
      code: 0,
      message: `Initiative supervisor already initialized for ${options.slug}`,
      details: existing as Record<string, unknown>
    };
  }

  const { manifestPath, manifest, created } = ensureManifest(repoRoot, options);
  const args = ["init", "--slug", options.slug, "--manifest", manifestPath];
  if (options.baseBranch) {
    args.push("--base-branch", options.baseBranch);
  }
  if (options.managerBranch) {
    args.push("--manager-branch", options.managerBranch);
  }
  if (typeof options.maxAttempts === "number") {
    args.push("--max-attempts", String(options.maxAttempts));
  }
  if (options.runnerProvider) {
    args.push("--runner-provider", options.runnerProvider);
  }
  if (options.runnerCommand) {
    args.push("--runner-command", options.runnerCommand);
  }
  for (const team of options.teams ?? []) {
    args.push("--team", team);
  }
  for (const issueId of options.issueIds ?? []) {
    args.push("--issue", issueId);
  }

  const createdState = invokeSupervisorRuntime(repoRoot, args) as Record<string, unknown>;
  const paused = invokeSupervisorRuntime(repoRoot, [
    "pause",
    "--slug",
    options.slug,
    "--reason",
    "initialized; run start to begin execution"
  ]);

  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor initialized for ${options.slug}`,
    details: {
      manifestPath,
      manifestCreated: created,
      manifestProject: isRecord(manifest.project) ? manifest.project : {},
      created: createdState,
      state: paused
    }
  };
}

export async function runInitiativeSupervisorInteractiveInitCommand(
  repoRoot: string,
  options: InteractiveInitOptions = {},
  io: {
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
    answers?: string[];
  } = {}
): Promise<CommandResult> {
  const resolved = await resolveInteractiveInitOptions(repoRoot, options, io.input, io.output, io.answers);
  const initResult = runInitiativeSupervisorInitCommand(repoRoot, resolved.init);

  if (!resolved.start) {
    return {
      ...initResult,
      message: `${initResult.message} (interactive wizard)`,
      details: {
        ...(isRecord(initResult.details) ? initResult.details : {}),
        interactive: true,
        started: false
      }
    };
  }

  const startResult = runInitiativeSupervisorStartCommand(repoRoot, { slug: resolved.init.slug });
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor initialized and started for ${resolved.init.slug}`,
    details: {
      init: initResult.details,
      start: startResult.details,
      interactive: true,
      started: true
    }
  };
}

export function runInitiativeSupervisorStatusCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeSupervisorRuntime(repoRoot, ["status", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor status for ${slug}`,
    details: payload as Record<string, unknown>
  };
}

export function runInitiativeSupervisorNextCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeSupervisorRuntime(repoRoot, ["graph", "next", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor next action for ${slug}`,
    details: payload as Record<string, unknown>
  };
}

export function runInitiativeSupervisorPauseCommand(
  repoRoot: string,
  options: { slug: string; reason?: string }
): CommandResult {
  const args = ["pause", "--slug", options.slug];
  if (options.reason) {
    args.push("--reason", options.reason);
  }
  const payload = invokeSupervisorRuntime(repoRoot, args);
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor paused for ${options.slug}`,
    details: payload as Record<string, unknown>
  };
}

export function runInitiativeSupervisorResumeCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeSupervisorRuntime(repoRoot, ["resume", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor resumed for ${slug}`,
    details: payload as Record<string, unknown>
  };
}

export function runInitiativeSupervisorAbortCommand(
  repoRoot: string,
  options: { slug: string; reason?: string }
): CommandResult {
  const args = ["abort", "--slug", options.slug];
  if (options.reason) {
    args.push("--reason", options.reason);
  }
  const payload = invokeSupervisorRuntime(repoRoot, args);
  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor aborted for ${options.slug}`,
    details: payload as Record<string, unknown>
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function continueInitiativeSupervisor(
  repoRoot: string,
  slug: string,
  state: SupervisorState,
  baseDetails: Record<string, unknown>
): CommandResult {
  const next = invokeSupervisorRuntime(repoRoot, ["graph", "next", "--slug", slug]) as Record<string, unknown>;
  const action = String(next.action ?? "unknown");

  if (!["launch_worker", "await_worker_launch"].includes(action)) {
    return {
      ok: true,
      code: 0,
      message: `Initiative supervisor started for ${slug}`,
      details: {
        ...baseDetails,
        next
      }
    };
  }

  const promptPayload = invokeSupervisorRuntime(repoRoot, ["prepare-worker-prompt", "--slug", slug]) as Record<
    string,
    unknown
  >;
  const issueId = String(promptPayload.issue ?? next.issue ?? "");
  const relativePromptPath = String(promptPayload.promptPath ?? next.promptPath ?? "");
  const absolutePromptPath = path.isAbsolute(relativePromptPath)
    ? relativePromptPath
    : path.join(repoRoot, relativePromptPath);
  const provider = resolveRunnerProvider(state);
  const commandTemplate = resolveRunnerCommandTemplate(state, provider);

  if (!commandTemplate) {
    return {
      ok: true,
      code: 0,
      message: `Initiative supervisor started for ${slug}; worker launch is waiting for a configured runner`,
      details: {
        ...baseDetails,
        next: {
          action: "await_worker_launch",
          issue: issueId,
          provider,
          promptPath: relativePromptPath
        },
        manualLaunchRequired: true,
        hint:
          "Configure a runner command via --runner-command at init time or env AIFORGE_RUNNER_COMMAND / AIFORGE_<PROVIDER>_RUNNER_COMMAND."
      }
    };
  }

  const renderedCommand = renderRunnerCommand(commandTemplate, {
    repoRoot,
    slug,
    issueId,
    promptPath: absolutePromptPath,
    provider
  });
  const runId = launchDetachedCommand(repoRoot, renderedCommand);
  const launchedState = invokeSupervisorRuntime(repoRoot, [
    "record-worker",
    "--slug",
    slug,
    "--issue",
    issueId,
    "--status",
    "launched",
    "--run-id",
    runId
  ]) as Record<string, unknown>;

  return {
    ok: true,
    code: 0,
    message: `Initiative supervisor started for ${slug}; worker launched for ${issueId}`,
    details: {
      ...launchedState,
      launch: {
        provider,
        runId,
        promptPath: relativePromptPath,
        commandTemplate
      }
    }
  };
}

