import { loadConfig } from "../core/config.js";
import { buildLlms } from "../core/llms.js";
import type { CommandResult } from "../core/types.js";

export async function runLlmsBuildCommand(repoRoot: string, dryRun = false): Promise<CommandResult> {
  if (dryRun) {
    const config = loadConfig(repoRoot);
    return {
      ok: true,
      code: 0,
      message: "Dry-run llms build completed",
      details: {
        profileId: config.profile.id,
        wouldWrite: [config.llms.txtPath, `${config.llms.rootDir}/README.md`, `${config.llms.rootDir}/index.md`]
      }
    };
  }

  const created = await buildLlms(repoRoot);
  return {
    ok: true,
    code: 0,
    message: "LLMS artifacts generated",
    details: { created }
  };
}
