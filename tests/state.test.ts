import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { createConfig, saveConfig, writeMachineManifest } from "../src/core/config.js";
import {
  INSTALLER_STATE_FILE_NAME,
  createDefaultInstallerState,
  loadInstallerStateOrNull,
  saveInstallerState,
  syncInstallerStateFromConfig
} from "../src/core/state.js";
import { makeTempRepo } from "./helpers.js";

describe("installer state (.aiforge.json)", () => {
  test("saveConfig writes installer state via machine manifest", () => {
    const repoRoot = makeTempRepo("aiforge-state-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "laravel-docker"
    });
    saveConfig(repoRoot, config);
    const statePath = path.join(repoRoot, INSTALLER_STATE_FILE_NAME);
    expect(fs.existsSync(statePath)).toBe(true);
    const state = loadInstallerStateOrNull(repoRoot, config);
    expect(state?.schemaVersion).toBe(1);
    expect(state?.runtimesEnabled).toEqual(config.runtimes);
  });

  test("writeMachineManifest refreshes installer state without yaml write", () => {
    const repoRoot = makeTempRepo("aiforge-state-manifest-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });
    saveConfig(repoRoot, config);
    const next = { ...config, runtimes: { ...config.runtimes, agents: false } };
    fs.unlinkSync(path.join(repoRoot, INSTALLER_STATE_FILE_NAME));
    writeMachineManifest(repoRoot, next);
    const state = loadInstallerStateOrNull(repoRoot, next);
    expect(state?.runtimesEnabled.agents).toBe(false);
  });

  test("syncInstallerStateFromConfig updates runtime mirror", () => {
    const repoRoot = makeTempRepo("aiforge-state-sync-");
    const config = createConfig({
      repoRoot,
      projectSlug: "x",
      projectName: "X",
      profileId: "vue-quasar-capacitor"
    });
    let state = createDefaultInstallerState(config);
    state.runtimesEnabled = { ...state.runtimesEnabled, cursor: false };
    const merged = syncInstallerStateFromConfig(state, config);
    expect(merged.runtimesEnabled.cursor).toBe(true);
  });

  test("saveInstallerState roundtrips extensions and remote skills", () => {
    const repoRoot = makeTempRepo("aiforge-state-roundtrip-");
    const config = createConfig({
      repoRoot,
      projectSlug: "z",
      projectName: "Z",
      profileId: "laravel-docker"
    });
    const state = createDefaultInstallerState(config);
    state.extensions = [{ name: "demo", source: "npm:demo", version: "1.0.0", installedAt: "2026-01-01T00:00:00.000Z" }];
    state.remoteSkills = [
      {
        id: "foo",
        source: "skills.sh",
        spec: "org/foo",
        versionOrHash: "abc",
        installedAt: "2026-01-01T00:00:00.000Z"
      }
    ];
    saveInstallerState(repoRoot, state);
    const loaded = loadInstallerStateOrNull(repoRoot, config);
    expect(loaded?.extensions).toHaveLength(1);
    expect(loaded?.remoteSkills[0]?.spec).toBe("org/foo");
  });
});
