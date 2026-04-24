import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runExtensionAddCommand } from "../src/commands/extension-add.js";
import { runExtensionListCommand } from "../src/commands/extension-list.js";
import { runExtensionRemoveCommand } from "../src/commands/extension-remove.js";
import { runInitCommand } from "../src/commands/init.js";
import { createFakeCopierBin, createFakeExecutable, makeTempRepo } from "./helpers.js";

describe("extension install", () => {
  const originalPath = process.env.PATH ?? "";
  const originalCopier = process.env.AI_SIMPLE_COPIER_BIN;

  beforeEach(() => {
    const fakeTaskBinDir = makeTempRepo("aiforge-task-bin-ext-");
    createFakeExecutable(
      fakeTaskBinDir,
      "go-task",
      `#!/usr/bin/env node
process.exit(0);
`
    );
    process.env.PATH = `${fakeTaskBinDir}:${originalPath}`;
    process.env.AI_SIMPLE_COPIER_BIN = createFakeCopierBin();
    delete process.env.AI_SIMPLE_COPIER_USE_PYTHON;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalCopier === undefined) {
      delete process.env.AI_SIMPLE_COPIER_BIN;
    } else {
      process.env.AI_SIMPLE_COPIER_BIN = originalCopier;
    }
  });

  test("installs local extension and lists it", async () => {
    const extRoot = makeTempRepo("aiforge-ext-src-");
    const skillDir = path.join(extRoot, "skills", "hello");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "---\nname: hello\ndescription: test\n---\nHello world.\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(extRoot, "extension.json"),
      JSON.stringify(
        {
          name: "demo-ext",
          version: "0.0.1",
          skills: ["skills/hello"]
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    const repoRoot = makeTempRepo("aiforge-ext-target-");
    await runInitCommand({
      repoRoot,
      projectName: "Ext Host",
      profileId: "laravel-docker",
      dryRun: false
    });

    const add = runExtensionAddCommand(repoRoot, extRoot);
    expect(add.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".aiforge", "extensions", "demo-ext", "extension.json"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "skills", "demo-ext__hello", "SKILL.md"))).toBe(true);

    const list = runExtensionListCommand(repoRoot);
    expect(list.ok).toBe(true);
    expect((list.details?.extensions as unknown[]).length).toBe(1);

    const rm = runExtensionRemoveCommand(repoRoot, "demo-ext");
    expect(rm.ok).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".aiforge", "extensions", "demo-ext"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "skills", "demo-ext__hello"))).toBe(false);
  });
});
