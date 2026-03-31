import path from "node:path";

import { loadConfig } from "./config.js";
import { ensureDir, writeTextFile } from "./filesystem.js";

export function scaffoldMcp(repoRoot: string): string[] {
  const config = loadConfig(repoRoot);
  const mcpDir = path.join(repoRoot, ".cursor", "mcp");
  ensureDir(mcpDir);

  const readmePath = path.join(mcpDir, "README.md");
  const examplePath = path.join(mcpDir, "mcp.example.json");

  const readme = `# MCP Scaffold\n\nProfile: ${config.profile.id}\n\nAdd project-specific MCP server blocks here or in your local runtime config.\n\n## Suggested placeholders\n\n${config.mcp.placeholders
    .map((placeholder) => `- ${placeholder}`)
    .join("\n")}\n`;

  const example = JSON.stringify(
    {
      servers: config.mcp.placeholders.map((placeholder) => ({
        name: placeholder,
        note: "Fill in transport/auth details for this project."
      }))
    },
    null,
    2
  );

  writeTextFile(readmePath, `${readme}\n`);
  writeTextFile(examplePath, `${example}\n`);

  return [readmePath, examplePath];
}
