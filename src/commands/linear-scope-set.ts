import { loadConfig, saveConfig } from "../core/config.js";
import {
  CURSOR_SETTINGS_FILE,
  LINEAR_SCOPE_FILE,
  applyLinearPrimaryScope,
  writeCursorSettingsFile,
  writeLinearScopeFile
} from "../core/linear.js";
import type { CommandResult } from "../core/types.js";

export function runLinearScopeSetCommand(
  repoRoot: string,
  options: {
    team: string;
    teamId?: string;
    project?: string;
    projectId?: string;
    defaultLabels: string[];
    dryRun?: boolean;
  }
): CommandResult {
  const config = loadConfig(repoRoot);
  const scopeOptions: {
    team: string;
    teamId?: string;
    project?: string;
    projectId?: string;
    defaultLabels: string[];
  } = {
    team: options.team,
    defaultLabels: options.defaultLabels
  };

  if (options.teamId) {
    scopeOptions.teamId = options.teamId;
  }

  if (options.project) {
    scopeOptions.project = options.project;
  }

  if (options.projectId) {
    scopeOptions.projectId = options.projectId;
  }

  const nextConfig = applyLinearPrimaryScope(config, scopeOptions);

  if (options.dryRun) {
    return {
      ok: true,
      code: 0,
      message: "Dry-run linear scope set completed",
      details: {
        tracker: nextConfig.workflow.tracker,
        scope: nextConfig.linear.scopes[0],
        wouldWrite: ["ai.config.yaml", ".agents/project.manifest.json", LINEAR_SCOPE_FILE, CURSOR_SETTINGS_FILE]
      }
    };
  }

  saveConfig(repoRoot, nextConfig);
  const scopePath = writeLinearScopeFile(repoRoot, nextConfig.linear.scopes);
  const settingsPath = writeCursorSettingsFile(repoRoot, true);

  return {
    ok: true,
    code: 0,
    message: "Linear scope updated",
    details: {
      tracker: nextConfig.workflow.tracker,
      scope: nextConfig.linear.scopes[0],
      created: ["ai.config.yaml", ".agents/project.manifest.json", scopePath, settingsPath]
    }
  };
}
