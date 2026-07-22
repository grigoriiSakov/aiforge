import { buildCopierAnswers } from "./config.js";
import { ensureCopierAnswersFile } from "./copier.js";
import { buildLlms } from "./llms.js";
import { generateManifesto } from "./manifesto.js";
import { scaffoldMcp } from "./mcp.js";
import { ensureOpenSpecProject } from "./openspec.js";
import { applyRuntimeFlags } from "./runtime.js";
import { ensureTaskRunnerInstalled } from "./task-runner.js";
import type { ProjectConfig } from "./types.js";

/**
 * Shared post-Copier steps for init/adopt/sync/update success paths.
 * Order matches historical `init` behavior.
 */
export async function finalizeAfterCopierCopy(
  repoRoot: string,
  templatePath: string,
  config: ProjectConfig
): Promise<void> {
  ensureTaskRunnerInstalled(repoRoot);
  ensureCopierAnswersFile({
    destinationPath: repoRoot,
    templatePath,
    answers: buildCopierAnswers(config)
  });
  applyRuntimeFlags(repoRoot);
  ensureOpenSpecProject(repoRoot, config);
  generateManifesto(repoRoot);
  await buildLlms(repoRoot);
  scaffoldMcp(repoRoot);
}
