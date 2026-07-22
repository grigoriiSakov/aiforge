import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";
import YAML from "yaml";

import { createConfig } from "../src/core/config.js";
import { ensureOpenSpecProject, resolveOpenSpecTools } from "../src/core/openspec.js";
import type { RuntimeFlags } from "../src/core/types.js";
import { createFakeExecutable, makeTempRepo } from "./helpers.js";

describe("OpenSpec integration", () => {
  test("maps enabled aiforge runtimes to supported OpenSpec tool ids", () => {
    const runtimes: RuntimeFlags = {
      cursor: true,
      codex: true,
      claude: false,
      agent: true,
      agents: true
    };

    expect(resolveOpenSpecTools(runtimes)).toEqual(["codex", "cursor", "antigravity"]);
  });

  test("initializes the core OpenSpec workflow non-interactively", () => {
    const repoRoot = makeTempRepo("aiforge-openspec-");
    const binDir = makeTempRepo("aiforge-openspec-bin-");
    const invocationPath = path.join(repoRoot, "openspec-invocation.json");
    const openSpecBin = createFakeExecutable(
      binDir,
      "fake-openspec",
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(process.env.AIFORGE_OPENSPEC_INVOCATION, JSON.stringify(process.argv.slice(2)) + "\\n");
const repoRoot = process.argv[3];
fs.mkdirSync(path.join(repoRoot, "openspec"), { recursive: true });
fs.writeFileSync(path.join(repoRoot, "openspec", "config.yaml"), "schema: spec-driven\\n");
`
    );
    process.env.AIFORGE_OPENSPEC_INVOCATION = invocationPath;
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "react-vite"
    });
    config.runtimes.claude = false;
    config.runtimes.agent = false;

    ensureOpenSpecProject(repoRoot, config, { bin: openSpecBin });

    expect(JSON.parse(fs.readFileSync(invocationPath, "utf8"))).toEqual([
      "init",
      repoRoot,
      "--tools",
      "codex,cursor",
      "--profile",
      "core"
    ]);
    const openSpecConfig = YAML.parse(
      fs.readFileSync(path.join(repoRoot, "openspec", "config.yaml"), "utf8")
    ) as { context?: string; rules?: Record<string, string[]> };
    expect(openSpecConfig.context).toContain("Profile: react-vite");
    expect(openSpecConfig.context).toContain("Canonical verify command: .ai/bin/go-task verify");
    expect(openSpecConfig.rules?.proposal).toContain("State explicit non-goals.");
    expect(openSpecConfig.rules?.tasks).toContain(
      "Map every task to a requirement and a canonical aiforge verification command."
    );
    delete process.env.AIFORGE_OPENSPEC_INVOCATION;
  });

  test("ships the OpenSpec CLI as a runtime dependency", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as { dependencies?: Record<string, string>; engines?: Record<string, string> };

    expect(packageJson.dependencies?.["@fission-ai/openspec"]).toMatch(/^\^1\./);
    expect(packageJson.engines?.node).toBe(">=20.19.0");
  });
});
