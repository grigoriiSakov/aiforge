import fs from "node:fs";
import path from "node:path";

import { buildCopierAnswers } from "./config.js";
import { ensureCopierAnswersFile } from "./copier.js";
import { buildLlms } from "./llms.js";
import { generateManifesto } from "./manifesto.js";
import { scaffoldMcp } from "./mcp.js";
import { ensureOpenSpecProject } from "./openspec.js";
import { applyRuntimeFlags } from "./runtime.js";
import { ensureTaskRunnerInstalled } from "./task-runner.js";
import type { ProjectConfig } from "./types.js";

const RETIRED_GENERATED_FILES = [
  path.join(".ai", "reference", "PROMPT_OPTIMIZATION_STRATEGY.md"),
  path.join(".ai", "reference", "issue-spec-template.md"),
  path.join(".ai", "reference", "plan-progress-template.md"),
  path.join(".ai", "reference", "plan-template.md"),
  path.join(".ai", "skills", "supervisor", "SKILL.md"),
  path.join(".ai", "runtime", "supervisor-state.mjs"),
  path.join(".ai", "runtime", "supervisor-context.mjs"),
  path.join(".ai", "runtime", "supervisor-daemon.mjs"),
  path.join(".ai", "runtime", "supervisor-linear-sync.mjs"),
  path.join(".ai", "runtime", "supervisor-launchers", "headless.mjs"),
  path.join(".ai", "runtime", "supervisor-launchers", "cursor.mjs"),
  path.join(".ai", "runtime", "supervisor-launchers", "claude.mjs"),
  path.join(".ai", "runtime", "supervisor-launchers", "codex.mjs")
];

const RETIRED_GENERATED_DIRECTORIES = [
  path.join(".ai", "skills", "supervisor"),
  path.join(".ai", "runtime", "supervisor-launchers")
];

export function previewRetiredGeneratedFiles(repoRoot: string): string[] {
  return RETIRED_GENERATED_FILES.filter((relativePath) =>
    fs.existsSync(path.join(repoRoot, relativePath))
  );
}

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
  removeRetiredGeneratedSurfaces(repoRoot);
  if (config.features.llms) {
    await buildLlms(repoRoot);
  } else {
    removeDisabledLlmsSurfaces(repoRoot, config);
  }
  scaffoldMcp(repoRoot);
}

function removeRetiredGeneratedSurfaces(repoRoot: string): void {
  for (const relativePath of RETIRED_GENERATED_FILES) {
    fs.rmSync(path.join(repoRoot, relativePath), { force: true });
  }

  for (const relativePath of RETIRED_GENERATED_DIRECTORIES) {
    try {
      fs.rmdirSync(path.join(repoRoot, relativePath));
    } catch {
      // Preserve non-generated files that may share a former generated directory.
    }
  }
}

function removeDisabledLlmsSurfaces(repoRoot: string, config: ProjectConfig): void {
  const txtPath = resolveGeneratedPath(repoRoot, config.llms.txtPath);
  if (txtPath) {
    fs.rmSync(txtPath, { force: true });
  }

  const rootPath = resolveGeneratedPath(repoRoot, config.llms.rootDir);
  if (!rootPath) {
    return;
  }

  for (const fileName of ["README.md", "index.md"]) {
    fs.rmSync(path.join(rootPath, fileName), { force: true });
  }

  try {
    if (fs.readdirSync(rootPath).length === 0) {
      fs.rmdirSync(rootPath);
    }
  } catch {
    // The directory may not exist or may contain project-owned files.
  }
}

function resolveGeneratedPath(repoRoot: string, relativePath: string): string | null {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const fromRoot = path.relative(repoRoot, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    return null;
  }

  return absolutePath;
}
