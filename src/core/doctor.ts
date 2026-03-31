import fs from "node:fs";
import path from "node:path";

import { CONFIG_FILE_NAME, MACHINE_MANIFEST_PATH, loadConfig } from "./config.js";
import { readJsonFileIfExists } from "./filesystem.js";
import type { CommandResult } from "./types.js";

export function runDoctor(repoRoot: string): CommandResult {
  const configPath = path.join(repoRoot, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) {
    return { ok: false, code: 2, message: `Missing ${CONFIG_FILE_NAME}` };
  }

  const config = loadConfig(repoRoot);
  const machineManifest = readJsonFileIfExists<Record<string, unknown>>(path.join(repoRoot, MACHINE_MANIFEST_PATH));
  const requiredSurfaces = [...config.managedSurfaces.map((surface) => surface.path), MACHINE_MANIFEST_PATH];
  const missing = requiredSurfaces.filter((surface) => {
    if (surface === ".agent" && !config.runtimes.agent) {
      return false;
    }
    if (surface === ".cursor" && !config.runtimes.cursor) {
      return false;
    }
    if (surface === ".codex" && !config.runtimes.codex) {
      return false;
    }
    return !fs.existsSync(path.join(repoRoot, surface));
  });

  if (missing.length > 0) {
    return {
      ok: false,
      code: 3,
      message: "Managed surfaces are missing",
      details: { missing, profile: config.profile.id, remediation: "Run aiforge sync or init." }
    };
  }

  if (!machineManifest || machineManifest.profile === undefined) {
    return {
      ok: false,
      code: 3,
      message: "Machine manifest is missing or invalid",
      details: { manifestPath: MACHINE_MANIFEST_PATH, remediation: "Run aiforge sync." }
    };
  }

  if (JSON.stringify(machineManifest) !== JSON.stringify(config)) {
    return {
      ok: false,
      code: 3,
      message: "Config drift detected between ai.config.yaml and machine manifest",
      details: {
        manifestPath: MACHINE_MANIFEST_PATH,
        remediation: "Run aiforge sync to regenerate machine-readable manifest."
      }
    };
  }

  return {
    ok: true,
    code: 0,
    message: "Doctor check passed",
    details: { profile: config.profile.id }
  };
}
