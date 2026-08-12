import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { readTextFileIfExists } from "./filesystem.js";
import type { LocalProjectConfig, ProjectConfig, RuntimeFlags } from "./types.js";

export const LOCAL_CONFIG_FILE_NAME = ".aiforge.local.yaml";
export const CREDENTIALS_ENV_FILE_NAME = ".aiforge.credentials.env";

const LOCAL_ROOT_KEYS = new Set(["schemaVersion", "orchestrator", "runtimes", "agents"]);
const RUNTIME_KEYS = new Set<keyof RuntimeFlags>(["cursor", "codex", "claude", "agent", "agents"]);
const MODEL_TIER_KEYS = new Set(["quality", "balanced", "budget"]);

export function loadLocalConfig(repoRoot: string): LocalProjectConfig | null {
  const content = readTextFileIfExists(path.join(repoRoot, LOCAL_CONFIG_FILE_NAME));
  if (!content) {
    return null;
  }

  const parsed = YAML.parse(content) as LocalProjectConfig | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${LOCAL_CONFIG_FILE_NAME} must contain a YAML object`);
  }

  validateLocalConfig(parsed);
  return parsed;
}

export function applyLocalConfig(base: ProjectConfig, local: LocalProjectConfig | null): ProjectConfig {
  if (!local) {
    return base;
  }

  const runtimeModels = { ...(base.agents.runtimeModels ?? {}) };
  for (const [runtime, hints] of Object.entries(local.agents?.runtimeModels ?? {})) {
    runtimeModels[runtime as keyof RuntimeFlags] = {
      ...(runtimeModels[runtime as keyof RuntimeFlags] ?? {}),
      ...(hints ?? {})
    };
  }

  return {
    ...base,
    orchestrator: {
      ...base.orchestrator,
      ...(local.orchestrator?.worktreeRoot
        ? { worktreeRoot: local.orchestrator.worktreeRoot }
        : {})
    },
    runtimes: {
      ...base.runtimes,
      ...local.runtimes
    },
    agents: {
      ...base.agents,
      runtimeModels
    }
  };
}

export function loadAiforgeEnvironment(
  repoRoot: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const envPath = path.join(repoRoot, CREDENTIALS_ENV_FILE_NAME);
  if (!fs.existsSync(envPath)) {
    return { ...baseEnv };
  }

  return {
    ...parseEnvFile(fs.readFileSync(envPath, "utf8")),
    ...baseEnv
  };
}

export function parseEnvFile(content: string): NodeJS.ProcessEnv {
  const parsed: NodeJS.ProcessEnv = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = normalized.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = normalized.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function validateLocalConfig(config: LocalProjectConfig): void {
  for (const key of Object.keys(config)) {
    if (!LOCAL_ROOT_KEYS.has(key)) {
      throw new Error(
        `${LOCAL_CONFIG_FILE_NAME} contains unsupported key "${key}"; ` +
          "allowed roots: schemaVersion, orchestrator, runtimes, agents"
      );
    }
  }

  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) {
    throw new Error(`${LOCAL_CONFIG_FILE_NAME} schemaVersion must be 1`);
  }

  if (
    config.orchestrator?.worktreeRoot !== undefined &&
    !config.orchestrator.worktreeRoot.trim()
  ) {
    throw new Error(`${LOCAL_CONFIG_FILE_NAME} orchestrator.worktreeRoot cannot be empty`);
  }
  for (const key of Object.keys(config.orchestrator ?? {})) {
    if (key !== "worktreeRoot") {
      throw new Error(`${LOCAL_CONFIG_FILE_NAME} orchestrator.${key} cannot override project truth`);
    }
  }

  for (const [runtime, enabled] of Object.entries(config.runtimes ?? {})) {
    if (!RUNTIME_KEYS.has(runtime as keyof RuntimeFlags) || typeof enabled !== "boolean") {
      throw new Error(`${LOCAL_CONFIG_FILE_NAME} runtimes.${runtime} must be a known boolean runtime`);
    }
  }

  for (const key of Object.keys(config.agents ?? {})) {
    if (key !== "runtimeModels") {
      throw new Error(`${LOCAL_CONFIG_FILE_NAME} agents.${key} cannot override project truth`);
    }
  }

  for (const [runtime, hints] of Object.entries(config.agents?.runtimeModels ?? {})) {
    if (!RUNTIME_KEYS.has(runtime as keyof RuntimeFlags)) {
      throw new Error(`${LOCAL_CONFIG_FILE_NAME} agents.runtimeModels.${runtime} is unknown`);
    }
    for (const [tier, slug] of Object.entries(hints ?? {})) {
      if (!MODEL_TIER_KEYS.has(tier) || typeof slug !== "string" || !slug.trim()) {
        throw new Error(
          `${LOCAL_CONFIG_FILE_NAME} agents.runtimeModels.${runtime}.${tier} must be a non-empty quality/balanced/budget model slug`
        );
      }
    }
  }
}
