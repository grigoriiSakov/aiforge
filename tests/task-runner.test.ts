import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

import { ensureTaskRunnerInstalled } from "../src/core/task-runner.js";
import { makeTempRepo } from "./helpers.js";

describe("task runner", () => {
  const originalPath = process.env.PATH;
  const originalInstaller = process.env.AIFORGE_TASK_INSTALLER_BIN;
  const originalAllowDownload = process.env.AIFORGE_ALLOW_TASK_DOWNLOAD;

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalInstaller === undefined) {
      delete process.env.AIFORGE_TASK_INSTALLER_BIN;
    } else {
      process.env.AIFORGE_TASK_INSTALLER_BIN = originalInstaller;
    }
    if (originalAllowDownload === undefined) {
      delete process.env.AIFORGE_ALLOW_TASK_DOWNLOAD;
    } else {
      process.env.AIFORGE_ALLOW_TASK_DOWNLOAD = originalAllowDownload;
    }
  });

  test("does not download Task unless explicitly allowed", () => {
    const repoRoot = makeTempRepo("aiforge-task-runner-");
    const emptyBin = makeTempRepo("aiforge-empty-path-");
    process.env.PATH = emptyBin;
    delete process.env.AIFORGE_TASK_INSTALLER_BIN;
    delete process.env.AIFORGE_ALLOW_TASK_DOWNLOAD;

    expect(() => ensureTaskRunnerInstalled(repoRoot)).toThrow(/AIFORGE_ALLOW_TASK_DOWNLOAD=1/);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "bin", "task"))).toBe(false);
  });

  test("wrapper loads credentials env while preserving process overrides", () => {
    const repoRoot = makeTempRepo("aiforge-task-env-");
    const binDir = path.join(repoRoot, ".ai", "bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, "task"),
      "#!/usr/bin/env node\nprocess.stdout.write(process.env.PROJECT_DOCKER_ROOT ?? 'missing');\n",
      { mode: 0o755 }
    );
    fs.writeFileSync(
      path.join(repoRoot, ".aiforge.credentials.env"),
      "PROJECT_DOCKER_ROOT=/from/credentials\n"
    );
    ensureTaskRunnerInstalled(repoRoot);

    const wrapper = path.join(repoRoot, ".ai", "bin", "go-task");
    const fromFile = spawnSync(wrapper, ["--version"], { cwd: repoRoot, encoding: "utf8" });
    const fromProcess = spawnSync(wrapper, ["--version"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, PROJECT_DOCKER_ROOT: "/from/process" }
    });

    expect(fromFile.stdout).toBe("/from/credentials");
    expect(fromProcess.stdout).toBe("/from/process");
  });
});
