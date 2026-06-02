import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  DEFAULT_AGENT_MODEL_TIERS,
  MODEL_PROFILES_MANIFEST_PATH,
  normalizeAgentModelTiers,
  tierForRole
} from "../src/core/agent-models.js";
import { createConfig, loadConfig, saveConfig } from "../src/core/config.js";
import { makeTempRepo } from "./helpers.js";

describe("agent model profiles", () => {
  test("createConfig seeds default tiers", () => {
    const config = createConfig({
      repoRoot: "",
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });

    expect(config.agents.modelTiers).toEqual(DEFAULT_AGENT_MODEL_TIERS);
    expect(config.agents.modelTiers.review).toBe("budget");
    expect(config.agents.modelTiers.implement).toBe("quality");
  });

  test("legacy config without modelTiers backfills on load", () => {
    const repoRoot = makeTempRepo("aiforge-agent-models-legacy-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });
    saveConfig(repoRoot, config);
    const configPath = path.join(repoRoot, "ai.config.yaml");
    const yaml = fs
      .readFileSync(configPath, "utf8")
      .replace(
        /agents:\n  modelTiers:\n(?:    [a-z]+: [a-z]+\n)+  markdown: ""/,
        'agents:\n  markdown: "team notes"\n'
      );
    fs.writeFileSync(configPath, yaml);
    const loaded = loadConfig(repoRoot);
    expect(loaded.agents.markdown).toBe("team notes");
    expect(loaded.agents.modelTiers.review).toBe("budget");
  });

  test("saveConfig writes model profiles manifest", () => {
    const repoRoot = makeTempRepo("aiforge-agent-models-manifest-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });
    config.agents.runtimeModels = {
      cursor: { budget: "gpt-5-mini", quality: "claude-opus-4-8-thinking-high" }
    };

    saveConfig(repoRoot, config);

    const manifestPath = path.join(repoRoot, MODEL_PROFILES_MANIFEST_PATH);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      roles: { review: { tier: string } };
      runtimeModels: { cursor: { budget: string } };
    };
    expect(manifest.roles.review.tier).toBe("budget");
    expect(manifest.runtimeModels.cursor.budget).toBe("gpt-5-mini");
  });

  test("normalizeAgentModelTiers rejects unknown values", () => {
    expect(
      normalizeAgentModelTiers({
        ...DEFAULT_AGENT_MODEL_TIERS,
        plan: "fast" as never
      }).plan
    ).toBe("balanced");
  });

  test("tierForRole resolves from normalized config", () => {
    const config = createConfig({
      repoRoot: "",
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });
    config.agents.modelTiers.audit = "quality";
    expect(tierForRole(config, "audit")).toBe("quality");
  });
});
