import { loadConfig } from "../core/config.js";
import { installExtensionFromPath } from "../core/extensions/install.js";
import type { CommandResult } from "../core/types.js";

export function runExtensionAddCommand(repoRoot: string, sourcePath: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    const result = installExtensionFromPath(repoRoot, config, sourcePath);
    return {
      ok: true,
      code: 0,
      message: `Installed extension ${result.extensionName}`,
      details: {
        extensionName: result.extensionName,
        installedSkills: result.installedSkills,
        securityVerdict: result.scan.verdict
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
