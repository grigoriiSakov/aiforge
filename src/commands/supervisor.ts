import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import type { CommandResult } from "../core/types.js";

const SUPERVISOR_STATE_RELATIVE_PATH = path.join(".ai", "runtime", "supervisor-state.mjs");
const SUPERVISOR_DAEMON_RELATIVE_PATH = path.join(".ai", "runtime", "supervisor-daemon.mjs");
const SUPERVISOR_SYNC_RELATIVE_PATH = path.join(".ai", "runtime", "supervisor-linear-sync.mjs");
const SUPERVISOR_RUNS_DIR = path.join(".ai", "runtime", "supervisor", "runs");

type SupervisorState = {
  slug: string;
  status: string;
  currentIssueId?: string | null;
  managerBranch?: string;
  issueOrder?: string[];
  issues?: Record<string, { status?: string }>;
};

function runtimePath(repoRoot: string, relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

function requireRuntime(repoRoot: string, relativePath: string): string {
  const targetPath = runtimePath(repoRoot, relativePath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${relativePath}. Run aiforge sync/init in the target repo before using supervisor.`);
  }
  return targetPath;
}

function invokeNodeScript(repoRoot: string, relativePath: string, args: string[]): Record<string, unknown> {
  const targetPath = requireRuntime(repoRoot, relativePath);
  const result = spawnSync("node", [targetPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `supervisor runtime failed: ${relativePath} ${args.join(" ")}`);
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    return {};
  }

  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return { raw: stdout };
  }
}

function readRun(repoRoot: string, slug: string): SupervisorState | null {
  const targetPath = path.join(repoRoot, SUPERVISOR_RUNS_DIR, `${slug}.json`);
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(targetPath, "utf8")) as SupervisorState;
}

export function runSupervisorStatusCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, ["status", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Supervisor status for ${slug}`,
    details: payload
  };
}

export function runSupervisorPauseCommand(
  repoRoot: string,
  options: { slug: string; reason?: string }
): CommandResult {
  const args = ["pause", "--slug", options.slug];
  if (options.reason) {
    args.push("--reason", options.reason);
  }
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, args);
  return {
    ok: true,
    code: 0,
    message: `Supervisor paused for ${options.slug}`,
    details: payload
  };
}

export function runSupervisorResumeCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, ["resume", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Supervisor resumed for ${slug}`,
    details: payload
  };
}

export function runSupervisorAbortCommand(
  repoRoot: string,
  options: { slug: string; reason?: string }
): CommandResult {
  const args = ["abort", "--slug", options.slug];
  if (options.reason) {
    args.push("--reason", options.reason);
  }
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, args);
  return {
    ok: true,
    code: 0,
    message: `Supervisor aborted for ${options.slug}`,
    details: payload
  };
}

export function runSupervisorSyncImportCommand(
  repoRoot: string,
  options: {
    slug: string;
    source?: string;
    manifest?: string;
  }
): CommandResult {
  const args = ["import", "--slug", options.slug];
  if (options.source) {
    args.push("--source", options.source);
  }
  if (options.manifest) {
    args.push("--manifest", options.manifest);
  }
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_SYNC_RELATIVE_PATH, args);
  return {
    ok: true,
    code: 0,
    message: `Supervisor source imported for ${options.slug}`,
    details: payload
  };
}

export function runSupervisorInitFromSourceCommand(
  repoRoot: string,
  options: {
    slug: string;
    source?: string;
    manifest?: string;
    teams?: string[];
    issueIds?: string[];
    baseBranch?: string;
    managerBranch?: string;
    maxAttempts?: number;
  }
): CommandResult {
  const args = ["init-from-linear", "--slug", options.slug];
  if (options.source) {
    args.push("--source", options.source);
  }
  if (options.manifest) {
    args.push("--manifest", options.manifest);
  }
  if (options.baseBranch) {
    args.push("--base-branch", options.baseBranch);
  }
  if (options.managerBranch) {
    args.push("--manager-branch", options.managerBranch);
  }
  if (typeof options.maxAttempts === "number") {
    args.push("--max-attempts", String(options.maxAttempts));
  }
  for (const team of options.teams ?? []) {
    args.push("--team", team);
  }
  for (const issueId of options.issueIds ?? []) {
    args.push("--issue", issueId);
  }
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, args);
  return {
    ok: true,
    code: 0,
    message: `Supervisor initialized for ${options.slug}`,
    details: payload
  };
}

export function runSupervisorDaemonCommand(
  repoRoot: string,
  options: {
    slug: string;
    launcher?: string;
    tickLimit?: number;
    pollMs?: number;
  }
): CommandResult {
  const args = ["run", "--slug", options.slug];
  if (options.launcher) {
    args.push("--launcher", options.launcher);
  }
  if (typeof options.tickLimit === "number") {
    args.push("--tick-limit", String(options.tickLimit));
  }
  if (typeof options.pollMs === "number") {
    args.push("--poll-ms", String(options.pollMs));
  }
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_DAEMON_RELATIVE_PATH, args);
  return {
    ok: true,
    code: 0,
    message: `Supervisor daemon finished for ${options.slug}`,
    details: payload
  };
}

export function runSupervisorNextCommand(repoRoot: string, slug: string): CommandResult {
  const payload = invokeNodeScript(repoRoot, SUPERVISOR_STATE_RELATIVE_PATH, ["graph", "next", "--slug", slug]);
  return {
    ok: true,
    code: 0,
    message: `Supervisor next action for ${slug}`,
    details: payload
  };
}

export function readSupervisorRun(repoRoot: string, slug: string): SupervisorState | null {
  return readRun(repoRoot, slug);
}
