import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  CONFIG_FILE_NAME,
  MACHINE_MANIFEST_PATH,
  createConfig,
  loadConfig,
  saveConfig
} from "../src/core/config.js";
import { makeTempRepo } from "./helpers.js";

describe("config lifecycle", () => {
  test("saves yaml config and machine manifest", () => {
    const repoRoot = makeTempRepo("ai-simple-config-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "laravel-docker"
    });

    const configPath = saveConfig(repoRoot, config);

    expect(configPath).toBe(path.join(repoRoot, CONFIG_FILE_NAME));
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, MACHINE_MANIFEST_PATH))).toBe(true);
    expect(loadConfig(repoRoot).profile.id).toBe("laravel-docker");
  });

  test("profile carries linear defaults", () => {
    const repoRoot = makeTempRepo("aiforge-config-linear-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo-web",
      projectName: "Demo Web",
      profileId: "vue-quasar-capacitor"
    });

    expect(config.linear.enabled).toBe(true);
    expect(config.linear.requireTrackerForIssueFlow).toBe(true);
    expect(config.linear.scopes[0]?.defaultLabels).toEqual(["frontend"]);
  });
});
