import { loadConfig } from "../core/config.js";
import { CURSOR_SETTINGS_FILE, LINEAR_SCOPE_FILE, writeCursorSettingsFile, writeLinearScopeFile } from "../core/linear.js";
import type { CommandResult } from "../core/types.js";

export function runLinearInitCommand(repoRoot: string, dryRun = false): CommandResult {
  const config = loadConfig(repoRoot);

  if (dryRun) {
    return {
      ok: true,
      code: 0,
      message: "Dry-run linear init completed",
      details: {
        linearEnabled: config.linear.enabled,
        scopes: config.linear.scopes,
        wouldWrite: [LINEAR_SCOPE_FILE, CURSOR_SETTINGS_FILE]
      }
    };
  }

  const scopePath = writeLinearScopeFile(repoRoot, config.linear.scopes);
  const settingsPath = writeCursorSettingsFile(repoRoot, true);

  return {
    ok: true,
    code: 0,
    message: "Linear scaffolding initialized",
    details: {
      created: [scopePath, settingsPath],
      nextSteps: [
        "Fill real teamId/projectId in .cursor/linear-scope.json if placeholders remain.",
        "Configure local Linear MCP auth/connection outside the repository if needed."
      ]
    }
  };
}
