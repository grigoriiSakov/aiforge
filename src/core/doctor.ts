import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { CONFIG_FILE_NAME, MACHINE_MANIFEST_PATH, loadEffectiveConfig } from "./config.js";
import { readJsonFileIfExists } from "./filesystem.js";
import { loadAiforgeEnvironment } from "./local-config.js";
import { resolveMcpProvider } from "./mcp-registry.js";
import { resolveOpenSpecTools } from "./openspec.js";
import { INSTALLER_STATE_FILE_NAME, loadInstallerStateOrNull } from "./state.js";
import type { CommandResult, RuntimeFlags } from "./types.js";
import { AIFORGE_VERSION } from "./version.js";

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

  const versionPath = path.join(repoRoot, ".aiforge-version");
  if (fs.existsSync(versionPath)) {
    const expectedVersion = fs.readFileSync(versionPath, "utf8").trim();
    if (expectedVersion && expectedVersion !== AIFORGE_VERSION) {
      return {
        ok: false,
        code: 3,
        message: "Installed aiforge version does not match the project pin",
        details: {
          expected: expectedVersion,
          actual: AIFORGE_VERSION,
          remediation: `Install aiforge@${expectedVersion}, then run aiforge sync.`
        }
      };
    }
  }

  const config = loadEffectiveConfig(repoRoot);
  const localEnv = loadAiforgeEnvironment(repoRoot);
  const machineManifest = readJsonFileIfExists<Record<string, unknown>>(path.join(repoRoot, MACHINE_MANIFEST_PATH));
  const requiredSurfaces = [...config.managedSurfaces.map((surface) => surface.path), MACHINE_MANIFEST_PATH];
  const missing = requiredSurfaces.filter((surface) => {
    const runtimeSurface = {
      ".cursor": "cursor",
      ".codex": "codex",
      ".claude": "claude",
      ".agent": "agent",
      ".agents": "agents"
    } as const;
    const runtime = runtimeSurface[surface as keyof typeof runtimeSurface];
    if (runtime && !config.runtimes[runtime]) {
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

  const taskCommand = config.task.command.includes(path.sep)
    ? path.resolve(repoRoot, config.task.command)
    : config.task.command;
  const taskCheck = spawnSync(taskCommand, ["--list"], {
    cwd: repoRoot,
    env: localEnv,
    encoding: "utf8",
    stdio: "pipe"
  });
  if (taskCheck.status !== 0) {
    return {
      ok: false,
      code: 3,
      message: "Task runner or Taskfile is invalid",
      details: {
        taskCommand: config.task.command,
        exitCode: taskCheck.status,
        remediation: "Run aiforge sync, then ensure `.ai/bin/go-task --list` succeeds."
      }
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
        if (!localEnv[envName]) {
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
