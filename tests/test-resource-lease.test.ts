import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, expect, test } from "vitest";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function waitForLine(file: string, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;
    const poll = () => {
      if (fs.existsSync(file) && fs.readFileSync(file, "utf8").split("\n").includes(line)) {
        resolve();
      } else if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${line}`));
      } else {
        setTimeout(poll, 20);
      }
    };
    poll();
  });
}

function waitForText(read: () => string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5_000;
    const poll = () => {
      if (read().includes(text)) resolve();
      else if (Date.now() >= deadline) reject(new Error(`Timed out waiting for ${text}`));
      else setTimeout(poll, 20);
    };
    poll();
  });
}

function completed(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

test("test resource lease serializes matching resource keys and reports the owner", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aiforge-lease-test-"));
  temporaryRoots.push(root);
  const runtime = path.join(root, "verify-lease.mjs");
  const log = path.join(root, "events.log");
  fs.copyFileSync(path.join(process.cwd(), "template/base/.ai/runtime/verify-lease.mjs.jinja"), runtime);
  const resource = `test-${path.basename(root)}`;

  const launch = (label: string, delay: number) => {
    const script = `const fs=require('fs');fs.appendFileSync(process.argv[1],'start:${label}\\n');setTimeout(()=>fs.appendFileSync(process.argv[1],'end:${label}\\n'),${delay})`;
    const child = spawn("node", [runtime, "run", "--", "node", "-e", script, log], {
      cwd: root,
      env: { ...process.env, AIFORGE_TEST_RESOURCE_KEY: resource },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    return { done: completed(child), stderr: () => stderr };
  };

  const first = launch("first", 1_500);
  await waitForLine(log, "start:first");
  const second = launch("second", 10);
  await waitForText(second.stderr, `Waiting for test resource ${resource}`);
  expect(fs.readFileSync(log, "utf8")).not.toContain("start:second");

  expect(await first.done).toBe(0);
  expect(await second.done).toBe(0);
  expect(fs.readFileSync(log, "utf8").trim().split("\n")).toEqual([
    "start:first",
    "end:first",
    "start:second",
    "end:second"
  ]);
}, 15_000);
