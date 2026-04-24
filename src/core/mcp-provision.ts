import { createHash } from "node:crypto";
import path from "node:path";

import { ensureDir, readTextFileIfExists, writeTextFile } from "./filesystem.js";
import { AIFORGE_MCP_SERVER_KEY_PREFIX, resolvePlaceholdersToBlocks } from "./mcp-registry.js";
import { loadInstallerStateOrNull, saveInstallerState, type AiforgeInstallerState } from "./state.js";
import type { ProjectConfig } from "./types.js";

function parseJsonFile(filePath: string): Record<string, unknown> {
  const text = readTextFileIfExists(filePath);
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stripAiforgeMcpServers(servers: Record<string, unknown>): Record<string, unknown> {
  const next = { ...servers };
  for (const key of Object.keys(next)) {
    if (key.startsWith(AIFORGE_MCP_SERVER_KEY_PREFIX)) {
      delete next[key];
    }
  }
  return next;
}

function mergeMcpServers(
  doc: Record<string, unknown>,
  key: "mcpServers",
  additions: Record<string, unknown>
): Record<string, unknown> {
  const raw = (doc[key] as Record<string, unknown> | undefined) ?? {};
  const cleaned = stripAiforgeMcpServers(raw);
  const merged = { ...cleaned, ...additions };
  return { ...doc, [key]: merged };
}

function serverBlocksFromResolved(
  resolved: ReturnType<typeof resolvePlaceholdersToBlocks>
): Record<string, unknown> {
  const entries: Record<string, unknown> = {};
  for (const row of resolved) {
    entries[row.key] = { ...row.definition.block };
  }
  return entries;
}

function writeMergedMcpJson(filePath: string, serverBlocks: Record<string, unknown>): void {
  const before = parseJsonFile(filePath);
  const merged = mergeMcpServers(before, "mcpServers", serverBlocks);
  ensureDir(path.dirname(filePath));
  writeTextFile(filePath, `${JSON.stringify(merged, null, 2)}\n`);
}

function updateInstallerMcpRecords(
  repoRoot: string,
  config: ProjectConfig,
  resolved: ReturnType<typeof resolvePlaceholdersToBlocks>,
  runtimeTargets: string[]
): void {
  const state = loadInstallerStateOrNull(repoRoot, config);
  if (!state) {
    return;
  }
  const canonical = JSON.stringify(
    resolved
      .map((r) => ({ k: r.key, b: r.definition.block }))
      .sort((a, b) => a.k.localeCompare(b.k))
  );
  const hash = createHash("sha256").update(canonical).digest("hex");
  const now = new Date().toISOString();
  const managedServers = resolved.map((r) => ({
    id: r.definition.id,
    runtimeTargets: [...runtimeTargets],
    configHash: hash,
    installedAt: now
  }));
  const next: AiforgeInstallerState = {
    ...state,
    mcp: { managedServers }
  };
  saveInstallerState(repoRoot, next);
}

/**
 * Writes/merges managed MCP blocks into runtime JSON files under `aiforge-*` server keys.
 * Preserves non-aiforge entries. Updates `.aiforge.json` MCP record hashes.
 */
export function provisionManagedMcp(repoRoot: string, config: ProjectConfig): string[] {
  if (!config.features.mcp || !config.mcp.scaffold) {
    return [];
  }

  const resolved = resolvePlaceholdersToBlocks(config.mcp.placeholders ?? []);
  const serverBlocks = serverBlocksFromResolved(resolved);
  const written: string[] = [];
  const runtimeTargets: string[] = [];

  if (config.runtimes.cursor) {
    const cursorPath = path.join(repoRoot, ".cursor", "mcp.json");
    writeMergedMcpJson(cursorPath, serverBlocks);
    written.push(cursorPath);
    runtimeTargets.push("cursor");
  }

  if (config.runtimes.claude) {
    const claudePath = path.join(repoRoot, ".mcp.json");
    writeMergedMcpJson(claudePath, serverBlocks);
    written.push(claudePath);
    runtimeTargets.push("claude");
  }

  if (config.runtimes.codex) {
    const codexPath = path.join(repoRoot, ".codex", "mcp.json");
    writeMergedMcpJson(codexPath, serverBlocks);
    written.push(codexPath);
    runtimeTargets.push("codex");
  }

  if (runtimeTargets.length === 0) {
    return written;
  }

  if (resolved.length > 0) {
    updateInstallerMcpRecords(repoRoot, config, resolved, runtimeTargets);
  } else {
    const state = loadInstallerStateOrNull(repoRoot, config);
    if (state) {
      saveInstallerState(repoRoot, { ...state, mcp: { managedServers: [] } });
    }
  }

  return written;
}
