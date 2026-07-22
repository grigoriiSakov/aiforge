import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runExtensionAddCommand } from "../src/commands/extension-add.js";
import { runExtensionListCommand } from "../src/commands/extension-list.js";
import { runExtensionRemoveCommand } from "../src/commands/extension-remove.js";
import { runInitCommand } from "../src/commands/init.js";
import {
  createFakeCopierBin,
  createFakeExecutable,
  createFakeOpenSpecBin,
  makeTempRepo
} from "./helpers.js";

describe("extension install", () => {
  const originalPath = process.env.PATH ?? "";
  const originalCopier = process.env.AI_SIMPLE_COPIER_BIN;
  const originalOpenSpec = process.env.AIFORGE_OPENSPEC_BIN;

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
    process.env.AIFORGE_OPENSPEC_BIN = createFakeOpenSpecBin();
    delete process.env.AI_SIMPLE_COPIER_USE_PYTHON;
    delete process.env.AIFORGE_ALLOW_TASK_DOWNLOAD;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalCopier === undefined) {
      delete process.env.AI_SIMPLE_COPIER_BIN;
    } else {
      process.env.AI_SIMPLE_COPIER_BIN = originalCopier;
    }
    if (originalOpenSpec === undefined) {
      delete process.env.AIFORGE_OPENSPEC_BIN;
    } else {
      process.env.AIFORGE_OPENSPEC_BIN = originalOpenSpec;
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

  test("rejects extension skill paths outside the extension root", async () => {
    const extRoot = makeTempRepo("aiforge-ext-src-");
    const sibling = `${extRoot}-sibling`;
    const skillDir = path.join(sibling, "hello");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: hello\ndescription: test\n---\n", "utf8");
    fs.writeFileSync(
      path.join(extRoot, "extension.json"),
      JSON.stringify({ name: "bad-ext", version: "0.0.1", skills: ["../" + path.basename(sibling) + "/hello"] }) +
        "\n",
      "utf8"
    );

    const repoRoot = makeTempRepo("aiforge-ext-target-");
    await runInitCommand({ repoRoot, projectName: "Ext Host", profileId: "laravel-docker", dryRun: false });

    const add = runExtensionAddCommand(repoRoot, extRoot);
    expect(add.ok).toBe(false);
    expect(add.message).toContain("Unsafe skill path");
  });

  test("rejects extension skill directories without SKILL.md", async () => {
    const extRoot = makeTempRepo("aiforge-ext-src-");
    fs.mkdirSync(path.join(extRoot, "skills", "empty"), { recursive: true });
    fs.writeFileSync(
      path.join(extRoot, "extension.json"),
      JSON.stringify({ name: "bad-ext", version: "0.0.1", skills: ["skills/empty"] }) + "\n",
      "utf8"
    );

    const repoRoot = makeTempRepo("aiforge-ext-target-");
    await runInitCommand({ repoRoot, projectName: "Ext Host", profileId: "laravel-docker", dryRun: false });

    const add = runExtensionAddCommand(repoRoot, extRoot);
    expect(add.ok).toBe(false);
    expect(add.message).toContain("missing SKILL.md");
  });

  test("records warnings and excludes package metadata when extension contains scripts", async () => {
    const extRoot = makeTempRepo("aiforge-ext-src-");
    const skillDir = path.join(extRoot, "skills", "scripted");
    fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(extRoot, ".git"), { recursive: true });
    fs.writeFileSync(path.join(extRoot, ".git", "config"), "metadata\n", "utf8");
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: scripted\ndescription: test\n---\n", "utf8");
    fs.writeFileSync(path.join(skillDir, "scripts", "helper.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.writeFileSync(
      path.join(extRoot, "extension.json"),
      JSON.stringify({ name: "warn-ext", version: "0.0.1", skills: ["skills/scripted"] }) + "\n",
      "utf8"
    );

    const repoRoot = makeTempRepo("aiforge-ext-target-");
    await runInitCommand({ repoRoot, projectName: "Ext Host", profileId: "laravel-docker", dryRun: false });

    const add = runExtensionAddCommand(repoRoot, extRoot);
    expect(add.ok).toBe(true);
    expect(add.details?.securityVerdict).toBe("warn");
    expect(fs.existsSync(path.join(repoRoot, ".aiforge", "extensions", "warn-ext", "SECURITY_WARN.txt"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".aiforge", "extensions", "warn-ext", ".git"))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "skills", "warn-ext__scripted", ".git"))).toBe(false);
  });
});
