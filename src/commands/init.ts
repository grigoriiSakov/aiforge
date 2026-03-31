import path from "node:path";

import { buildCopierAnswers, createConfig, saveConfig } from "../core/config.js";
import {
  cleanupTemporaryAnswersFile,
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
import { resolveTemplatePath } from "../core/template.js";
import type { CommandResult, ProjectProfileId } from "../core/types.js";

export async function runInitCommand(options: {
  repoRoot: string;
  projectName?: string;
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
  const projectName = options.projectName ?? projectSlug;
  const config = createConfig({
    repoRoot: options.repoRoot,
    projectSlug,
    projectName,
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
        force: true,
        trust: true
      });
    } finally {
      cleanupTemporaryAnswersFile(answersFilePath);
    }

    return {
      ok: true,
      code: 0,
      message: `Dry-run init for profile ${profileId}`,
      details: { profileId, detected, wouldWrite: ["ai.config.yaml", ".agents/project.manifest.json"] }
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
      force: true,
      trust: true
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
    message: `Initialized project with profile ${profileId}`,
    details: { configPath, profileId, detected }
  };
}
