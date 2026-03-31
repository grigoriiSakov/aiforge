import { ensureCopierAnswersFile, ensureCopierInstalled, runCopierUpdate } from "../core/copier.js";
import { applyProfileToConfig, buildCopierAnswers, loadConfig, saveConfig } from "../core/config.js";
import { buildLlms } from "../core/llms.js";
import { generateManifesto } from "../core/manifesto.js";
import { scaffoldMcp } from "../core/mcp.js";
import { applyRuntimeFlags } from "../core/runtime.js";
import { cleanupSnapshot, createManagedSnapshot, restoreManagedSnapshot } from "../core/snapshot.js";
import { resolveTemplatePath } from "../core/template.js";
import type { CommandResult, ProjectProfileId } from "../core/types.js";

export async function runUpdateCommand(
  repoRoot: string,
  dryRun: boolean,
  profileId?: ProjectProfileId
): Promise<CommandResult> {
  ensureCopierInstalled();
  const loadedConfig = loadConfig(repoRoot);
  const config = profileId ? applyProfileToConfig(loadedConfig, profileId) : loadedConfig;

  if (dryRun) {
    const preparedAnswers = ensureCopierAnswersFile({
      destinationPath: repoRoot,
      templatePath: resolveTemplatePath(),
      answers: buildCopierAnswers(config)
    });
    try {
      runCopierUpdate(repoRoot, true, true);
      return {
        ok: true,
        code: 0,
        message: "Dry-run template update completed"
      };
    } finally {
      preparedAnswers.restore();
    }
  }

  const snapshot = createManagedSnapshot(repoRoot, config);
  try {
    saveConfig(repoRoot, config);
    ensureCopierAnswersFile({
      destinationPath: repoRoot,
      templatePath: resolveTemplatePath(),
      answers: buildCopierAnswers(config)
    });
    runCopierUpdate(repoRoot, true, false);

    applyRuntimeFlags(repoRoot);
    generateManifesto(repoRoot);
    await buildLlms(repoRoot);
    scaffoldMcp(repoRoot);
  } catch (error) {
    restoreManagedSnapshot(repoRoot, snapshot);
    throw error;
  } finally {
    cleanupSnapshot(snapshot);
  }

  return {
    ok: true,
    code: 0,
    message: "Template update completed"
  };
}
