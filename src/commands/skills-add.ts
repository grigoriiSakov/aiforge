import { loadConfig } from "../core/config.js";
import { installRemoteSkillFromGit } from "../core/remote-skills.js";
import type { CommandResult } from "../core/types.js";

export function runSkillsAddGitCommand(repoRoot: string, gitUrl: string, skillId: string): CommandResult {
  try {
    const config = loadConfig(repoRoot);
    const result = installRemoteSkillFromGit({ repoRoot, config, gitUrl, skillId });
    return {
      ok: true,
      code: 0,
      message: `Installed remote skill ${skillId}`,
      details: { dest: result.destRelative, securityVerdict: result.securityVerdict }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, code: 4, message };
  }
}
