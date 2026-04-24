import { loadConfig } from "../core/config.js";
import { removeRemoteSkill } from "../core/remote-skills.js";
import type { CommandResult } from "../core/types.js";

export function runSkillsRemoveCommand(repoRoot: string, skillId: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    removeRemoteSkill(repoRoot, config, skillId);
    return { ok: true, code: 0, message: `Removed remote skill ${skillId}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
