import { loadConfig } from "../core/config.js";
import { loadInstallerStateOrNull } from "../core/state.js";
import type { CommandResult } from "../core/types.js";

export function runSkillsListCommand(repoRoot: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    const state = loadInstallerStateOrNull(repoRoot, config);
    if (!state) {
      return { ok: false, code: 3, message: "Missing .aiforge.json" };
    }
    return {
      ok: true,
      code: 0,
      message: `Remote skills: ${state.remoteSkills.length}`,
      details: { remoteSkills: state.remoteSkills }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
