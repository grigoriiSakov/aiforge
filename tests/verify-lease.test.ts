import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import { makeTempRepo } from "./helpers.js";

function waitForFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;
    const poll = () => {
      if (fs.existsSync(filePath)) return resolve();
      if (Date.now() >= deadline) return reject(new Error(`timed out waiting for ${filePath}`));
      setTimeout(poll, 20);
    };
    poll();
  });
}

describe("host-wide verify lease", () => {
  test("serializes full verify bodies from separate project processes", async () => {
    const repoRoot = makeTempRepo("aiforge-verify-lease-");
    const runtimePath = path.join(repoRoot, "verify-lease.mjs");
    const markerPath = path.join(repoRoot, "first-running");
    fs.copyFileSync(
      path.join(
        process.cwd(),
        "template",
        "base",
        ".ai",
        "runtime",
        "verify-lease.mjs.jinja"
      ),
      runtimePath
    );

    const first = spawn(
      "node",
      [
        runtimePath,
        "run",
        "--",
        "node",
        "-e",
        `require('fs').writeFileSync(${JSON.stringify(markerPath)}, '1'); setTimeout(() => { require('fs').unlinkSync(${JSON.stringify(markerPath)}); }, 350);`
      ],
      { cwd: repoRoot, stdio: "ignore" }
    );
    const firstDone = new Promise<void>((resolve, reject) => {
      first.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`first exited ${code}`))));
      first.once("error", reject);
    });
    await waitForFile(markerPath);

    const second = spawnSync(
      "node",
      [
        runtimePath,
        "run",
        "--",
        "node",
        "-e",
        `process.exit(require('fs').existsSync(${JSON.stringify(markerPath)}) ? 9 : 0)`
      ],
      { cwd: repoRoot, encoding: "utf8" }
    );

    expect(second.status).toBe(0);
    await firstDone;
  }, 10_000);
});
