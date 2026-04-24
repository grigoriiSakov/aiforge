import path from "node:path";

import { readJsonFileIfExists, writeTextFile } from "./filesystem.js";
import type { ProjectConfig, RuntimeFlags } from "./types.js";

/** Installer / CLI-managed state at repo root (separate from process truth `ai.config.yaml`). */
export const INSTALLER_STATE_FILE_NAME = ".aiforge.json";

export const INSTALLER_STATE_SCHEMA_VERSION = 1 as const;

/** Single managed MCP server entry tracked by aiforge. */
export interface AiforgeManagedMcpServer {
  id: string;
  /** Which agent runtimes received this block (e.g. cursor, codex, claude). */
  runtimeTargets: string[];
  /** SHA-256 hex of canonical JSON of the merged server block for drift detection. */
  configHash: string;
  installedAt: string;
}

export interface AiforgeExtensionRecord {
  name: string;
  source: string;
  version: string;
  installedAt: string;
}

/** Remote or marketplace skill pin. */
export interface AiforgeRemoteSkillRecord {
  id: string;
  source: "skills.sh" | "git" | "local" | "url";
  /** Repo slug, URL, or path depending on source. */
  spec: string;
  versionOrHash: string;
  installedAt: string;
}

export interface AiforgeSecurityScanRecord {
  artifact: string;
  verdict: "clean" | "warn" | "blocked";
  at: string;
  notes?: string;
}

export interface AiforgeWizardMeta {
  completedSetup: boolean;
  lastInteractiveProfile?: string;
}

export interface AiforgeInstallerState {
  schemaVersion: typeof INSTALLER_STATE_SCHEMA_VERSION;
  /** ISO 8601 timestamp of last successful setup/sync that touched installer state. */
  lastSetupAt?: string;
  /** Mirror of `config.runtimes` at last sync (for doctor drift hints). */
  runtimesEnabled: RuntimeFlags;
  mcp: {
    managedServers: AiforgeManagedMcpServer[];
  };
  extensions: AiforgeExtensionRecord[];
  remoteSkills: AiforgeRemoteSkillRecord[];
  security: {
    lastScans: AiforgeSecurityScanRecord[];
  };
  wizard: AiforgeWizardMeta;
}

export function createDefaultInstallerState(config: ProjectConfig): AiforgeInstallerState {
  return {
    schemaVersion: INSTALLER_STATE_SCHEMA_VERSION,
    lastSetupAt: new Date().toISOString(),
    runtimesEnabled: { ...config.runtimes },
    mcp: { managedServers: [] },
    extensions: [],
    remoteSkills: [],
    security: { lastScans: [] },
    wizard: { completedSetup: false }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRuntimeFlags(value: unknown, fallback: RuntimeFlags): RuntimeFlags {
  if (!isRecord(value)) {
    return { ...fallback };
  }
  return {
    cursor: Boolean(value.cursor),
    codex: Boolean(value.codex),
    claude: Boolean(value.claude),
    agent: Boolean(value.agent),
    agents: Boolean(value.agents)
  };
}

function migratePartialState(raw: Record<string, unknown>, config: ProjectConfig): AiforgeInstallerState {
  const base = createDefaultInstallerState(config);
  const mcp = isRecord(raw.mcp) ? raw.mcp : {};
  const managed = Array.isArray(mcp.managedServers) ? mcp.managedServers : [];

  const extensions = Array.isArray(raw.extensions)
    ? (raw.extensions as unknown[]).filter(isRecord).map((e) => ({
        name: String(e.name ?? ""),
        source: String(e.source ?? ""),
        version: String(e.version ?? ""),
        installedAt: String(e.installedAt ?? new Date().toISOString())
      }))
    : [];

  const remoteSkills = Array.isArray(raw.remoteSkills)
    ? (raw.remoteSkills as unknown[]).filter(isRecord).map((s) => ({
        id: String(s.id ?? ""),
        source: (["skills.sh", "git", "local", "url"].includes(String(s.source))
          ? (s.source as AiforgeRemoteSkillRecord["source"])
          : "local") as AiforgeRemoteSkillRecord["source"],
        spec: String(s.spec ?? ""),
        versionOrHash: String(s.versionOrHash ?? ""),
        installedAt: String(s.installedAt ?? new Date().toISOString())
      }))
    : [];

  const security = isRecord(raw.security) && Array.isArray(raw.security.lastScans)
    ? {
        lastScans: (raw.security.lastScans as unknown[]).filter(isRecord).map((r) => ({
          artifact: String(r.artifact ?? ""),
          verdict: (["clean", "warn", "blocked"].includes(String(r.verdict))
            ? r.verdict
            : "warn") as AiforgeSecurityScanRecord["verdict"],
          at: String(r.at ?? new Date().toISOString()),
          ...(typeof r.notes === "string" ? { notes: r.notes } : {})
        }))
      }
    : base.security;

  const wizard = isRecord(raw.wizard)
    ? {
        completedSetup: Boolean(raw.wizard.completedSetup),
        ...(typeof raw.wizard.lastInteractiveProfile === "string"
          ? { lastInteractiveProfile: raw.wizard.lastInteractiveProfile }
          : {})
      }
    : base.wizard;

  const managedServers: AiforgeManagedMcpServer[] = managed
    .filter(isRecord)
    .map((m) => ({
      id: String(m.id ?? ""),
      runtimeTargets: Array.isArray(m.runtimeTargets)
        ? (m.runtimeTargets as unknown[]).map((t) => String(t))
        : [],
      configHash: String(m.configHash ?? ""),
      installedAt: String(m.installedAt ?? new Date().toISOString())
    }))
    .filter((m) => m.id.length > 0);

  return {
    schemaVersion: INSTALLER_STATE_SCHEMA_VERSION,
    ...(typeof raw.lastSetupAt === "string" ? { lastSetupAt: raw.lastSetupAt } : {}),
    runtimesEnabled: parseRuntimeFlags(raw.runtimesEnabled, config.runtimes),
    mcp: { managedServers },
    extensions,
    remoteSkills,
    security,
    wizard
  };
}

/**
 * Load installer state or return null if missing.
 * Requires `config` only when file exists and needs migration merge.
 */
export function loadInstallerStateOrNull(repoRoot: string, config: ProjectConfig): AiforgeInstallerState | null {
  const filePath = path.join(repoRoot, INSTALLER_STATE_FILE_NAME);
  const raw = readJsonFileIfExists<unknown>(filePath);
  if (!raw || !isRecord(raw)) {
    return null;
  }
  const sv = raw.schemaVersion;
  if (sv !== undefined && sv !== null && sv !== INSTALLER_STATE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported ${INSTALLER_STATE_FILE_NAME} schemaVersion: ${String(sv)}. Expected ${String(INSTALLER_STATE_SCHEMA_VERSION)}.`
    );
  }
  return migratePartialState(raw, config);
}

export function saveInstallerState(repoRoot: string, state: AiforgeInstallerState): string {
  const filePath = path.join(repoRoot, INSTALLER_STATE_FILE_NAME);
  writeTextFile(filePath, `${JSON.stringify(state, null, 2)}\n`);
  return filePath;
}

/** Merge runtimes from process config into installer state and bump lastSetupAt. */
export function syncInstallerStateFromConfig(
  state: AiforgeInstallerState,
  config: ProjectConfig
): AiforgeInstallerState {
  return {
    ...state,
    lastSetupAt: new Date().toISOString(),
    runtimesEnabled: { ...config.runtimes }
  };
}

/**
 * Ensure `.aiforge.json` exists and reflects current config runtimes.
 * Call after `saveConfig` / successful template apply.
 */
export function ensureInstallerState(repoRoot: string, config: ProjectConfig): string {
  const existing = loadInstallerStateOrNull(repoRoot, config);
  const merged = syncInstallerStateFromConfig(existing ?? createDefaultInstallerState(config), config);
  return saveInstallerState(repoRoot, merged);
}

export function installerStatePath(repoRoot: string): string {
  return path.join(repoRoot, INSTALLER_STATE_FILE_NAME);
}
