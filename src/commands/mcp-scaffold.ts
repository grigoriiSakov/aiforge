import { scaffoldMcp } from "../core/mcp.js";
import type { CommandResult } from "../core/types.js";

export function runMcpScaffoldCommand(repoRoot: string, dryRun = false): CommandResult {
  if (dryRun) {
    return {
      ok: true,
      code: 0,
      message: "Dry-run MCP scaffold completed",
      details: { wouldWrite: [".cursor/mcp/README.md", ".cursor/mcp/mcp.example.json"] }
    };
  }

  const created = scaffoldMcp(repoRoot);
  return {
    ok: true,
    code: 0,
    message: "MCP scaffold created",
    details: { created }
  };
}
