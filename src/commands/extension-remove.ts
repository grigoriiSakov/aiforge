import { loadConfig } from "../core/config.js";
import { removeExtension } from "../core/extensions/install.js";
import type { CommandResult } from "../core/types.js";

export function runExtensionRemoveCommand(repoRoot: string, name: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    removeExtension(repoRoot, config, name);
    return { ok: true, code: 0, message: `Removed extension ${name}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
