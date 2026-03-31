import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import YAML from "yaml";

import { writeTextFile } from "./filesystem.js";
import type { CopierRunOptions } from "./types.js";

const COPIER_ANSWERS_FILE = ".copier-answers.yml";

type CopierCommand = {
  bin: string;
  prefixArgs: string[];
  label: string;
};

export function runCopierCopy(options: CopierRunOptions): void {
  const command = resolveCopierCommand();
  const args = [
    "copy",
    "--defaults",
    "--overwrite",
    "--data-file",
    options.dataFilePath
  ];

  if (options.dryRun) {
    args.push("--pretend");
  }

  if (options.force) {
    args.push("--force");
  }

  if (options.trust) {
    args.push("--trust");
  }

  args.push(options.templatePath, options.destinationPath);

  const result = spawnSync(command.bin, [...command.prefixArgs, ...args], {
    stdio: "inherit",
    cwd: options.destinationPath
  });

  if (result.status !== 0) {
    throw new Error(`Copier copy failed with exit code ${String(result.status)}`);
  }
}

export function runCopierUpdate(destinationPath: string, trust = false, dryRun = false): void {
  const command = resolveCopierCommand();
  const args = ["update"];

  if (dryRun) {
    args.push("--pretend");
  }

  if (trust) {
    args.push("--trust");
  }

  const result = spawnSync(command.bin, [...command.prefixArgs, ...args], {
    stdio: "inherit",
    cwd: destinationPath
  });

  if (result.status !== 0) {
    throw new Error(`Copier update failed with exit code ${String(result.status)}`);
  }
}

export function ensureCopierAnswersFile(params: {
  destinationPath: string;
  templatePath: string;
  answers: Record<string, unknown>;
}): { restore: () => void } {
  const answersPath = path.join(params.destinationPath, COPIER_ANSWERS_FILE);
  const previousContent = fs.existsSync(answersPath) ? fs.readFileSync(answersPath, "utf8") : null;
  const existingAnswers = parseAnswers(previousContent);
  const templateReferenceAnswers = buildTemplateReferenceAnswers(params.templatePath);
  const nextAnswers: Record<string, unknown> = {
    ...existingAnswers,
    ...params.answers,
    ...templateReferenceAnswers
  };

  if (
    !("_commit" in templateReferenceAnswers) &&
    typeof existingAnswers._commit === "string" &&
    existingAnswers._commit.trim()
  ) {
    nextAnswers._commit = existingAnswers._commit;
  }

  const nextContent = YAML.stringify(nextAnswers);
  if (previousContent !== nextContent) {
    writeTextFile(answersPath, nextContent);
  }

  return {
    restore: () => {
      if (previousContent === null) {
        fs.rmSync(answersPath, { force: true });
        return;
      }

      writeTextFile(answersPath, previousContent);
    }
  };
}

export function writeTemporaryAnswersFile(data: Record<string, unknown>): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-simple-copier-"));
  const targetPath = path.join(tempDir, "answers.yml");
  writeTextFile(targetPath, YAML.stringify(data));
  return targetPath;
}

export function cleanupTemporaryAnswersFile(filePath: string): void {
  fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
}

export function ensureCopierInstalled(): void {
  resolveCopierCommand();
}

function parseAnswers(content: string | null): Record<string, unknown> {
  if (!content) {
    return {};
  }

  try {
    const parsed = YAML.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function buildTemplateReferenceAnswers(templatePath: string): Record<string, unknown> {
  const gitRoot = runGit(["-C", templatePath, "rev-parse", "--show-toplevel"]);
  const gitCommit = runGit(["-C", templatePath, "rev-parse", "HEAD"]);

  if (!gitRoot || !gitCommit) {
    return { _src_path: templatePath };
  }

  const normalizedTemplatePath = path.resolve(templatePath);
  const normalizedGitRoot = path.resolve(gitRoot);
  const relativeSubdirectory = path.relative(normalizedGitRoot, normalizedTemplatePath);
  const answers: Record<string, unknown> = {
    _src_path: normalizedGitRoot,
    _commit: gitCommit
  };

  if (relativeSubdirectory && relativeSubdirectory !== ".") {
    answers._subdirectory = relativeSubdirectory;
  }

  return answers;
}

function runGit(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.status !== 0) {
    return null;
  }

  const value = result.stdout.trim();
  return value ? value : null;
}

function resolveCopierCommand(): CopierCommand {
  const override = process.env.AI_SIMPLE_COPIER_BIN;
  if (override) {
    return resolveSpecificCommand({ bin: override, prefixArgs: [], label: override });
  }

  const pythonModule = process.env.AI_SIMPLE_COPIER_USE_PYTHON === "1";
  if (pythonModule) {
    return resolveSpecificCommand({
      bin: "python3",
      prefixArgs: ["-m", "copier"],
      label: "python3 -m copier"
    });
  }

  const candidates: CopierCommand[] = [
    { bin: "copier", prefixArgs: [], label: "copier" },
    { bin: "uvx", prefixArgs: ["--from", "copier", "copier"], label: "uvx --from copier copier" },
    {
      bin: "uv",
      prefixArgs: ["tool", "run", "--from", "copier", "copier"],
      label: "uv tool run --from copier copier"
    },
    { bin: "pipx", prefixArgs: ["run", "copier"], label: "pipx run copier" },
    { bin: "python3", prefixArgs: ["-m", "copier"], label: "python3 -m copier" }
  ];

  for (const candidate of candidates) {
    if (isCommandAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Copier is not available. Install `copier`, or make one of these available in PATH: `uvx`, `uv`, `pipx`, `python3 -m copier`."
  );
}

function resolveSpecificCommand(command: CopierCommand): CopierCommand {
  if (isCommandAvailable(command)) {
    return command;
  }

  throw new Error(`Configured Copier command is not available: \`${command.label}\`.`);
}

function isCommandAvailable(command: CopierCommand): boolean {
  const result = spawnSync(command.bin, [...command.prefixArgs, "--help"], {
    stdio: "ignore"
  });

  return result.status === 0;
}
