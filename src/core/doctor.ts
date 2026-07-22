import fs from "node:fs";
import path from "node:path";

import { CONFIG_FILE_NAME, MACHINE_MANIFEST_PATH, loadConfig } from "./config.js";
import { readJsonFileIfExists } from "./filesystem.js";
import { resolveMcpProvider } from "./mcp-registry.js";
import { resolveOpenSpecTools } from "./openspec.js";
import { INSTALLER_STATE_FILE_NAME, loadInstallerStateOrNull } from "./state.js";
import type { CommandResult, RuntimeFlags } from "./types.js";

function runtimesEqual(a: RuntimeFlags, b: RuntimeFlags): boolean {
  return (
    a.cursor === b.cursor &&
    a.codex === b.codex &&
    a.claude === b.claude &&
    a.agent === b.agent &&
    a.agents === b.agents
  );
}

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

  const openSpecConfigPath = path.join(repoRoot, "openspec", "config.yaml");
  const openSpecProposeSkillPath = path.join(
    repoRoot,
    ".ai",
    "skills",
    "openspec-propose",
    "SKILL.md"
  );
  if (
    !fs.existsSync(openSpecConfigPath) ||
    (resolveOpenSpecTools(config.runtimes).length > 0 && !fs.existsSync(openSpecProposeSkillPath))
  ) {
    return {
      ok: false,
      code: 3,
      message: "OpenSpec workflow is missing or incomplete",
      details: {
        configPath: "openspec/config.yaml",
        proposeSkillPath: ".ai/skills/openspec-propose/SKILL.md",
        remediation: "Run aiforge sync to reinstall OpenSpec workflows."
      }
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

  const installerPath = path.join(repoRoot, INSTALLER_STATE_FILE_NAME);
  if (!fs.existsSync(installerPath)) {
    return {
      ok: false,
      code: 3,
      message: `Missing ${INSTALLER_STATE_FILE_NAME}`,
      details: {
        installerPath: INSTALLER_STATE_FILE_NAME,
        remediation: "Run aiforge sync or aiforge init to create installer state."
      }
    };
  }

  const installerState = loadInstallerStateOrNull(repoRoot, config);
  if (!installerState) {
    return {
      ok: false,
      code: 3,
      message: `Invalid or empty ${INSTALLER_STATE_FILE_NAME}`,
      details: { remediation: "Run aiforge sync to regenerate installer state." }
    };
  }

  if (!runtimesEqual(installerState.runtimesEnabled, config.runtimes)) {
    return {
      ok: false,
      code: 3,
      message: "Installer state drift: runtimes in .aiforge.json do not match ai.config.yaml",
      details: {
        expected: config.runtimes,
        actual: installerState.runtimesEnabled,
        remediation: "Run aiforge sync to refresh .aiforge.json from ai.config.yaml."
      }
    };
  }

  const mcpEnvHints: string[] = [];
  if (config.features.mcp) {
    for (const ph of config.mcp.placeholders ?? []) {
      const def = resolveMcpProvider(ph);
      if (!def?.requiredEnv) {
        continue;
      }
      for (const envName of def.requiredEnv) {
        if (!process.env[envName]) {
          mcpEnvHints.push(`${def.id}: set environment variable ${envName}`);
        }
      }
    }
  }

  return {
    ok: true,
    code: 0,
    message: "Doctor check passed",
    details: {
      profile: config.profile.id,
      ...(mcpEnvHints.length > 0 ? { mcpEnvHints } : {})
    }
  };
}
