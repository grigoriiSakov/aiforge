import fs from "node:fs";
import path from "node:path";

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
});
