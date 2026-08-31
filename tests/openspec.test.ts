import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";
import YAML from "yaml";

import { createConfig } from "../src/core/config.js";
import {
  ensureOpenSpecProject,
  resolveOpenSpecTools,
  runOpenSpecCli
} from "../src/core/openspec.js";
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
    expect(openSpecConfig.rules?.tasks).toContain(
      "Require scoped tests and lint before review, then full verification after a clean review."
    );
    delete process.env.AIFORGE_OPENSPEC_INVOCATION;
  });

  test("replaces the obsolete full-verify-before-review rule", () => {
    const repoRoot = makeTempRepo("aiforge-openspec-rule-migration-");
    const binDir = makeTempRepo("aiforge-openspec-rule-bin-");
    const openSpecBin = createFakeExecutable(
      binDir,
      "fake-openspec",
      `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const repoRoot = process.argv[3];
fs.mkdirSync(path.join(repoRoot, "openspec"), { recursive: true });
`
    );
    fs.mkdirSync(path.join(repoRoot, "openspec"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "openspec", "config.yaml"),
      [
        "schema: spec-driven",
        "rules:",
        "  tasks:",
        "    - Include focused tests and the full verification gate required before review.",
        ""
      ].join("\n")
    );
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "react-vite"
    });

    ensureOpenSpecProject(repoRoot, config, { bin: openSpecBin });

    const content = fs.readFileSync(path.join(repoRoot, "openspec", "config.yaml"), "utf8");
    const parsed = YAML.parse(content) as { rules?: Record<string, string[]> };
    expect(content).not.toContain("full verification gate required before review");
    expect(parsed.rules?.tasks).toContain(
      "Require scoped tests and lint before review, then full verification after a clean review."
    );
  });

  test("ships the OpenSpec CLI as a runtime dependency", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
    ) as {
      bin?: Record<string, string>;
      dependencies?: Record<string, string>;
      engines?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["@fission-ai/openspec"]).toMatch(/^\^1\./);
    expect(packageJson.bin?.openspec).toBe("./dist/src/cli/openspec.js");
    expect(packageJson.engines?.node).toBe(">=20.19.0");
  });

  test("forwards CLI arguments unchanged to the external OpenSpec package", () => {
    const tempDir = makeTempRepo("aiforge-openspec-proxy-");
    const invocationPath = path.join(tempDir, "invocation.json");
    const openSpecBin = createFakeExecutable(
      tempDir,
      "fake-openspec-proxy",
      `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.AIFORGE_OPENSPEC_PROXY_INVOCATION, JSON.stringify(process.argv.slice(2)) + "\\n");
`
    );
    process.env.AIFORGE_OPENSPEC_PROXY_INVOCATION = invocationPath;

    const status = runOpenSpecCli(["validate", "my-change", "--strict"], { bin: openSpecBin });

    expect(status).toBe(0);
    expect(JSON.parse(fs.readFileSync(invocationPath, "utf8"))).toEqual([
      "validate",
      "my-change",
      "--strict"
    ]);
    delete process.env.AIFORGE_OPENSPEC_PROXY_INVOCATION;
  });
});
