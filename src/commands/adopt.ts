import path from "node:path";

import { buildCopierAnswers, createConfig, saveConfig } from "../core/config.js";
import {
  cleanupTemporaryAnswersFile,
  ensureCopierInstalled,
  runCopierCopy,
  writeTemporaryAnswersFile
} from "../core/copier.js";
import { detectProfile } from "../core/profiles/detect.js";
import { cleanupSnapshot, createManagedSnapshot, restoreManagedSnapshot } from "../core/snapshot.js";
import { finalizeAfterCopierCopy } from "../core/setup.js";
import { resolveTemplatePath } from "../core/template.js";
import { promptInitWizard } from "../core/wizard.js";
import type { CommandResult, ProjectProfileId } from "../core/types.js";

export async function runAdoptCommand(options: {
  repoRoot: string;
  profileId?: ProjectProfileId;
  dryRun: boolean;
  interactive?: boolean;
}): Promise<CommandResult> {
  ensureCopierInstalled();

  const detected = detectProfile(options.repoRoot);
  let profileId = options.profileId ?? detected.recommendedProfile;
  let displayName: string | undefined;
  let wizardAnswers: Awaited<ReturnType<typeof promptInitWizard>> | undefined;

  if (options.interactive) {
    wizardAnswers = await promptInitWizard({
      repoSlug: path.basename(options.repoRoot),
      detected,
      forceProfilePrompt: Boolean(
        options.interactive && (detected.score === 0 || detected.confidence === "low")
      )
    });
    if (wizardAnswers.profileId) {
      profileId = wizardAnswers.profileId;
    }
    if (wizardAnswers.projectName) {
      displayName = wizardAnswers.projectName;
    }
  }

  if (!options.profileId && !options.interactive && detected.score === 0) {
    throw new Error("Unable to detect profile confidently. Pass --profile explicitly or use --interactive.");
  }
  if (detected.score === 0 && !profileId) {
    throw new Error("No profile selected. Pass --profile or use --interactive to choose a profile.");
  }

  const projectSlug = path.basename(options.repoRoot);
  const config = createConfig({
    repoRoot: options.repoRoot,
    projectSlug,
    projectName: displayName ?? projectSlug,
    profileId,
    detectionResult: detected
  });

  if (wizardAnswers?.manifestoStub) {
    config.manifesto.markdown = `${wizardAnswers.manifestoStub}\n`;
  }
  if (wizardAnswers?.agentsStub) {
    config.agents = { ...config.agents, markdown: `${wizardAnswers.agentsStub}\n` };
  }
  if (wizardAnswers?.projectRulesStub) {
    config.projectRules = { ...config.projectRules, markdown: `${wizardAnswers.projectRulesStub}\n` };
  }

  const answersFilePath = writeTemporaryAnswersFile(buildCopierAnswers(config));

  if (options.dryRun) {
    try {
      runCopierCopy({
        templatePath: resolveTemplatePath(),
        destinationPath: options.repoRoot,
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
      message: `Dry-run adopt for profile ${profileId}`,
      details: { detected, wouldWrite: ["ai.config.yaml", ".ai/project.manifest.json", ".aiforge.json"] }
    };
  }

  const snapshot = createManagedSnapshot(options.repoRoot, config);
  let configPath = "";
  const templatePath = resolveTemplatePath();
  try {
    configPath = saveConfig(options.repoRoot, config);
    runCopierCopy({
      templatePath,
      destinationPath: options.repoRoot,
      dataFilePath: answersFilePath,
      dryRun: false,
      force: false,
      trust: true
    });
    await finalizeAfterCopierCopy(options.repoRoot, templatePath, config);
  } catch (error) {
    restoreManagedSnapshot(options.repoRoot, snapshot);
    throw error;
  } finally {
    cleanupTemporaryAnswersFile(answersFilePath);
    cleanupSnapshot(snapshot);
  }

  return {
    ok: true,
    code: 0,
    message: `Adopted existing repo with profile ${profileId}`,
    details: { configPath, detected }
  };
}
