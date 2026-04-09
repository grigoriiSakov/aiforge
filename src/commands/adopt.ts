import path from "node:path";

import { buildCopierAnswers, createConfig, saveConfig } from "../core/config.js";
import {
  cleanupTemporaryAnswersFile,
  ensureCopierAnswersFile,
  ensureCopierInstalled,
  runCopierCopy,
  writeTemporaryAnswersFile
} from "../core/copier.js";
import { detectProfile } from "../core/profiles/detect.js";
import { buildLlms } from "../core/llms.js";
import { generateManifesto } from "../core/manifesto.js";
import { scaffoldMcp } from "../core/mcp.js";
import { applyRuntimeFlags } from "../core/runtime.js";
import { cleanupSnapshot, createManagedSnapshot, restoreManagedSnapshot } from "../core/snapshot.js";
import { ensureTaskRunnerInstalled } from "../core/task-runner.js";
import { resolveTemplatePath } from "../core/template.js";
import type { CommandResult, ProjectProfileId } from "../core/types.js";

export async function runAdoptCommand(options: {
  repoRoot: string;
  profileId?: ProjectProfileId;
  dryRun: boolean;
}): Promise<CommandResult> {
  ensureCopierInstalled();

  const detected = detectProfile(options.repoRoot);
  const profileId = options.profileId ?? detected.recommendedProfile;
  if (!options.profileId && detected.score === 0) {
    throw new Error("Unable to detect profile confidently. Pass --profile explicitly.");
  }
  const projectSlug = path.basename(options.repoRoot);
  const config = createConfig({
    repoRoot: options.repoRoot,
    projectSlug,
    projectName: projectSlug,
    profileId,
    detectionResult: detected
  });

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
      details: { detected, wouldWrite: ["ai.config.yaml", ".ai/project.manifest.json"] }
    };
  }

  const snapshot = createManagedSnapshot(options.repoRoot, config);
  let configPath = "";
  try {
    configPath = saveConfig(options.repoRoot, config);
    runCopierCopy({
      templatePath: resolveTemplatePath(),
      destinationPath: options.repoRoot,
      dataFilePath: answersFilePath,
      dryRun: false,
      force: false,
      trust: true
    });
    ensureTaskRunnerInstalled(options.repoRoot);
    ensureCopierAnswersFile({
      destinationPath: options.repoRoot,
      templatePath: resolveTemplatePath(),
      answers: buildCopierAnswers(config)
    });

    applyRuntimeFlags(options.repoRoot);
    generateManifesto(options.repoRoot);
    await buildLlms(options.repoRoot);
    scaffoldMcp(options.repoRoot);
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
