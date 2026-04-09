import fs from "node:fs";
import path from "node:path";
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

function runtimePath(repoRoot: string): string {
  return path.join(repoRoot, SUPERVISOR_RUNTIME_RELATIVE_PATH);
}

function runStatePath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, SUPERVISOR_RUNS_DIR, `${slug}.json`);
}

function defaultManifestPath(repoRoot: string, slug: string): string {
  return path.join(repoRoot, ".ai", "context", "initiatives", slug, "issues-manifest.json");
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

function requireManifest(
  repoRoot: string,
  options: {
    slug: string;
    manifest?: string;
  }
): string {
  const targetPath = path.resolve(options.manifest ? options.manifest : defaultManifestPath(repoRoot, options.slug));
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `Missing initiative manifest: ${targetPath}. Create/sync .ai/context/initiatives/${options.slug}/issues-manifest.json first.`
    );
  }
  return targetPath;
}

function patchManifest(repoRoot: string, options: {
  slug: string;
  manifest?: string;
  baseBranch?: string;
  managerBranch?: string;
  maxAttempts?: number;
  project?: string;
  projectId?: string;
  tracker?: string;
}): { manifestPath: string; manifest: Record<string, unknown> } {
  const manifestPath = requireManifest(repoRoot, options);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;

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
  return { manifestPath, manifest };
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
  options: {
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
  }
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

  const { manifestPath, manifest } = patchManifest(repoRoot, options);
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

  const created = invokeSupervisorRuntime(repoRoot, args) as Record<string, unknown>;
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
      manifestProject: isRecord(manifest.project) ? manifest.project : {},
      created,
      state: paused
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

