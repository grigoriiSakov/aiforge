import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import YAML from "yaml";

import { writeTextFile } from "./filesystem.js";
import type { CopierRunOptions } from "./types.js";

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
  const command = resolveCopierCommand();
  const result = spawnSync(command.bin, [...command.prefixArgs, "--help"], {
    stdio: "ignore"
  });

  if (result.status !== 0) {
    throw new Error(
      "Copier is not available. Install it with `uv tool install copier` or `pipx install copier`."
    );
  }
}

function resolveCopierCommand(): { bin: string; prefixArgs: string[] } {
  const override = process.env.AI_SIMPLE_COPIER_BIN;
  if (override) {
    return { bin: override, prefixArgs: [] };
  }

  const pythonModule = process.env.AI_SIMPLE_COPIER_USE_PYTHON === "1";
  if (pythonModule) {
    return { bin: "python3", prefixArgs: ["-m", "copier"] };
  }

  return { bin: "copier", prefixArgs: [] };
}
