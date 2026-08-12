import { applyProfileToConfig, buildCopierAnswers, loadConfig, saveConfig, writeMachineManifest } from "../core/config.js";
import { applyLocalConfig, loadLocalConfig } from "../core/local-config.js";
import {
  cleanupTemporaryAnswersFile,
  ensureCopierInstalled,
  runCopierCopy,
  writeTemporaryAnswersFile
} from "../core/copier.js";
import { finalizeAfterCopierCopy, previewRetiredGeneratedSurfaces } from "../core/setup.js";
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
  const sharedConfig = profileId ? applyProfileToConfig(loadedConfig, profileId) : loadedConfig;
  const config = applyLocalConfig(sharedConfig, loadLocalConfig(repoRoot));
  // Tracked Copier surfaces must be identical for every developer. Local
  // overlays are written to ignored machine manifests and consumed at runtime.
  const answersFilePath = writeTemporaryAnswersFile(buildCopierAnswers(sharedConfig));

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
      details: {
        profileId: config.profile.id,
        wouldRemove: previewRetiredGeneratedSurfaces(repoRoot)
      }
    };
  }

  const snapshot = createManagedSnapshot(repoRoot, config);
  const templatePath = resolveTemplatePath();
  try {
    if (profileId) {
      saveConfig(repoRoot, sharedConfig);
    }
    writeMachineManifest(repoRoot, config);
    runCopierCopy({
      templatePath,
      destinationPath: repoRoot,
      dataFilePath: answersFilePath,
      dryRun: false,
      force: false,
      trust: true
    });
    await finalizeAfterCopierCopy(repoRoot, templatePath, config);
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
