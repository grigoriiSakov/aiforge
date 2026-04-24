import path from "node:path";

import { loadConfig } from "./config.js";
import { ensureDir, writeTextFile } from "./filesystem.js";
import { listKnownMcpProviderIds, resolveMcpProvider } from "./mcp-registry.js";
import { provisionManagedMcp } from "./mcp-provision.js";

export function scaffoldMcp(repoRoot: string): string[] {
  const config = loadConfig(repoRoot);
  const mcpDir = path.join(repoRoot, ".cursor", "mcp");
  ensureDir(mcpDir);

  const readmePath = path.join(mcpDir, "README.md");
  const examplePath = path.join(mcpDir, "mcp.example.json");

  const unknown = (config.mcp.placeholders ?? []).filter((p) => !resolveMcpProvider(p));
  const known = (config.mcp.placeholders ?? []).filter((p) => resolveMcpProvider(p));

  const readme = [
    "# MCP (aiforge managed)",
    "",
    `Profile: ${config.profile.id}`,
    "",
    "Managed server entries are written under keys prefixed with `aiforge-` in:",
    "",
    "- `.cursor/mcp.json` (Cursor)",
    "- `.mcp.json` (Claude Code)",
    "- `.codex/mcp.json` (Codex CLI, experimental)",
    "",
    "Non-`aiforge-*` entries are preserved on regenerate.",
    "",
    "## From ai.config.yaml placeholders",
    "",
    ...(known.length > 0
      ? ["Resolved built-in providers:", ...known.map((p) => `- ${p}`), ""]
      : ["(none resolved — add known ids to `mcp.placeholders`)", ""]),
    ...(unknown.length > 0
      ? [
          "## Unknown placeholders (add registry entry or configure manually)",
          "",
          ...unknown.map((p) => `- ${p}`),
          ""
        ]
      : []),
    "## Known built-in provider ids",
    "",
    ...listKnownMcpProviderIds().map((id) => `- ${id}`),
    ""
  ].join("\n");

  const example = JSON.stringify(
    {
      note: "Legacy example catalog; real config is merged into ../mcp.json by aiforge.",
      placeholders: config.mcp.placeholders.map((placeholder) => ({
        name: placeholder,
        resolved: Boolean(resolveMcpProvider(placeholder))
      }))
    },
    null,
    2
  );

  writeTextFile(readmePath, `${readme}\n`);
  writeTextFile(examplePath, `${example}\n`);

  const provisioned = provisionManagedMcp(repoRoot, config);
  return [...provisioned, readmePath, examplePath];
}
