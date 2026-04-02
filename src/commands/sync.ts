import { applyProfileToConfig, buildCopierAnswers, loadConfig, saveConfig, writeMachineManifest } from "../core/config.js";
import {
  cleanupTemporaryAnswersFile,
  ensureCopierAnswersFile,
  ensureCopierInstalled,
  runCopierCopy,
  writeTemporaryAnswersFile
} from "../core/copier.js";
import { buildLlms } from "../core/llms.js";
import { generateManifesto } from "../core/manifesto.js";
import { scaffoldMcp } from "../core/mcp.js";
import { applyRuntimeFlags } from "../core/runtime.js";
import { cleanupSnapshot, createManagedSnapshot, restoreManagedSnapshot } from "../core/snapshot.js";
import { resolveTemplatePath } from "../core/template.js";
import type { CommandResult, ProjectProfileId } from "../core/types.js";

export async function runSyncCommand(
  repoRoot: string,
  dryRun: boolean,
  profileId?: ProjectProfileId
): Promise<CommandResult> {
  ensureCopierInstalled();

  const loadedConfig = loadConfig(repoRoot);
  const config = profileId ? applyProfileToConfig(loadedConfig, profileId) : loadedConfig;
  const answersFilePath = writeTemporaryAnswersFile(buildCopierAnswers(config));

  if (dryRun) {
    try {
      runCopierCopy({
        templatePath: resolveTemplatePath(),
        destinationPath: repoRoot,
        dataFilePath: answersFilePath,
        dryRun: true,
        force: false,
        trust: true
      });
    } finally {
      cleanupTemporaryAnswersFile(answersFilePath);
    }

    return {
      ok: true,
      code: 0,
      message: "Dry-run sync completed",
      details: { profileId: config.profile.id }
    };
  }

  const snapshot = createManagedSnapshot(repoRoot, config);
  try {
    if (profileId) {
      saveConfig(repoRoot, config);
    } else {
      writeMachineManifest(repoRoot, config);
    }
    runCopierCopy({
      templatePath: resolveTemplatePath(),
      destinationPath: repoRoot,
      dataFilePath: answersFilePath,
      dryRun: false,
      force: false,
      trust: true
    });
    ensureCopierAnswersFile({
      destinationPath: repoRoot,
      templatePath: resolveTemplatePath(),
      answers: buildCopierAnswers(config)
    });

    applyRuntimeFlags(repoRoot);
    generateManifesto(repoRoot);
    await buildLlms(repoRoot);
    scaffoldMcp(repoRoot);
  } catch (error) {
    restoreManagedSnapshot(repoRoot, snapshot);
    throw error;
  } finally {
    cleanupTemporaryAnswersFile(answersFilePath);
    cleanupSnapshot(snapshot);
  }

  return {
    ok: true,
    code: 0,
    message: "Managed surfaces synchronized",
    details: { profileId: config.profile.id, configWritten: Boolean(profileId) }
  };
}
