import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { ensureDir } from "./filesystem.js";
import type { TaskCommands } from "./types.js";

export const DEFAULT_TASK_COMMAND = ".ai/bin/go-task";
export const DEFAULT_TASK_BINARY = ".ai/bin/task";
export const TASK_COMMAND_PLACEHOLDER = "{{task_command}}";

export function renderTaskCommands(taskCommands: TaskCommands, taskCommand: string): TaskCommands {
  return {
    implement: renderCommandList(taskCommands.implement, taskCommand),
    test: renderCommandList(taskCommands.test, taskCommand),
    lint: renderCommandList(taskCommands.lint, taskCommand),
    verify: renderCommandList(taskCommands.verify, taskCommand),
    review: renderCommandList(taskCommands.review, taskCommand)
  };
}

export function ensureTaskRunnerInstalled(repoRoot: string): void {
  writeTaskRunnerWrapper(repoRoot);

  if (isTaskRunnerUsable(repoRoot)) {
    return;
  }

  installLocalTaskBinary(repoRoot);

  if (isTaskRunnerUsable(repoRoot)) {
    return;
  }

  throw new Error(
    "go-task runner is not available. Install `go-task`, set AIFORGE_TASK_INSTALLER_BIN, or set AIFORGE_ALLOW_TASK_DOWNLOAD=1 to allow aiforge to download Task into `.ai/bin/task`."
  );
}

function renderCommandList(commands: string[], taskCommand: string): string[] {
  return commands.map((command) => command.replaceAll(TASK_COMMAND_PLACEHOLDER, taskCommand));
}

function writeTaskRunnerWrapper(repoRoot: string): void {
  const wrapperPath = path.join(repoRoot, DEFAULT_TASK_COMMAND);
  ensureDir(path.dirname(wrapperPath));
  fs.writeFileSync(
    wrapperPath,
    `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const args = process.argv.slice(2);
const candidates = [path.join(scriptDir, "task"), "go-task", "task"];

for (const candidate of candidates) {
  if (candidate.includes(path.sep) && !fs.existsSync(candidate)) {
    continue;
  }

  const result = spawnSync(candidate, args, { stdio: "inherit" });
  if (result.error && result.error.code === "ENOENT") {
    continue;
  }
  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

process.stderr.write(
  "go-task runner is missing. Re-run aiforge init/adopt/sync/update, or install go-task manually.\\n"
);
process.exit(1);
`,
    { mode: 0o755 }
  );
}

function isTaskRunnerUsable(repoRoot: string): boolean {
  const result = spawnSync(DEFAULT_TASK_COMMAND, ["--version"], {
    cwd: repoRoot,
    stdio: "ignore"
  });
  return result.status === 0;
}

function installLocalTaskBinary(repoRoot: string): void {
  const installDir = path.join(repoRoot, path.dirname(DEFAULT_TASK_BINARY));
  const localBinaryPath = path.join(repoRoot, DEFAULT_TASK_BINARY);
  if (fs.existsSync(localBinaryPath)) {
    return;
  }

  ensureDir(installDir);

  const override = process.env.AIFORGE_TASK_INSTALLER_BIN;
  if (override) {
    runInstaller(override, [installDir], repoRoot, override);
    return;
  }

  if (process.env.AIFORGE_ALLOW_TASK_DOWNLOAD !== "1") {
    return;
  }

  const installers = [
    {
      bin: "sh",
      args: [
        "-c",
        'curl --fail --silent --show-error --location https://taskfile.dev/install.sh | sh -s -- -d -b "$1"',
        "aiforge-task-install",
        installDir
      ],
      label: "curl -> task install.sh"
    },
    {
      bin: "sh",
      args: [
        "-c",
        'wget -qO- https://taskfile.dev/install.sh | sh -s -- -d -b "$1"',
        "aiforge-task-install",
        installDir
      ],
      label: "wget -> task install.sh"
    }
  ];

  for (const installer of installers) {
    if (runInstaller(installer.bin, installer.args, repoRoot, installer.label)) {
      return;
    }
  }
}

function runInstaller(bin: string, args: string[], cwd: string, label: string): boolean {
  const result = spawnSync(bin, args, {
    cwd,
    stdio: "ignore"
  });

  if (isEnoentError(result.error)) {
    return false;
  }

  if (result.status === 0) {
    return true;
  }

  throw new Error(`Failed to install go-task via ${label}.`);
}

function isEnoentError(error: Error | undefined): boolean {
  return Boolean(error && "code" in error && error.code === "ENOENT");
}
