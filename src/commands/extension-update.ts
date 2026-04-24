import { loadConfig } from "../core/config.js";
import { updateExtensionFromPath } from "../core/extensions/install.js";
import type { CommandResult } from "../core/types.js";

export function runExtensionUpdateCommand(repoRoot: string, name: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    updateExtensionFromPath(repoRoot, config, name);
    return { ok: true, code: 0, message: `Updated extension ${name}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
