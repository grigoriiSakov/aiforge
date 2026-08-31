import path from "node:path";

import { ensureDir, writeTextFile } from "./filesystem.js";
import type {
  AgentModelRole,
  AgentModelTier,
  AgentModelTiers,
  ProjectConfig,
  RuntimeFlags,
  RuntimeModelHints
} from "./types.js";

export const MODEL_PROFILES_MANIFEST_PATH = path.join(".ai", "project.model-profiles.json");

export const AGENT_MODEL_TIER_VALUES: readonly AgentModelTier[] = ["quality", "balanced", "budget"];

export const AGENT_MODEL_ROLE_VALUES: readonly AgentModelRole[] = [
  "orchestrator",
  "plan",
  "skeptic",
  "clarify",
  "implement",
  "review",
  "audit",
  "simplifyReview",
  "tracker"
];

export const DEFAULT_AGENT_MODEL_TIERS: AgentModelTiers = {
  orchestrator: "balanced",
  plan: "balanced",
  skeptic: "balanced",
  clarify: "balanced",
  implement: "quality",
  review: "budget",
  audit: "budget",
  simplifyReview: "budget",
  tracker: "balanced"
};

export const MODEL_TIER_SEMANTICS: Record<
  AgentModelTier,
  { label: string; useWhen: string }
> = {
  quality: {
    label: "Quality",
    useWhen: "architecture, full reviews, tricky refactors, orchestration with wide blast radius"
  },
  balanced: {
    label: "Balanced",
    useWhen: "planning, tracker sync, clarify, default main-session work"
  },
  budget: {
    label: "Budget",
    useWhen: "simple reviews, lint-only passes, narrow checklist work"
  }
};

export function normalizeAgentModelTier(value: unknown, fallback: AgentModelTier): AgentModelTier {
  if (typeof value === "string" && (AGENT_MODEL_TIER_VALUES as readonly string[]).includes(value)) {
    return value as AgentModelTier;
  }

  return fallback;
}

export function normalizeAgentModelTiers(current: Partial<AgentModelTiers> | undefined): AgentModelTiers {
  const defaults = DEFAULT_AGENT_MODEL_TIERS;
  return {
    orchestrator: normalizeAgentModelTier(current?.orchestrator, defaults.orchestrator),
    plan: normalizeAgentModelTier(current?.plan, defaults.plan),
    skeptic: normalizeAgentModelTier(current?.skeptic, defaults.skeptic),
    clarify: normalizeAgentModelTier(current?.clarify, defaults.clarify),
    implement: normalizeAgentModelTier(current?.implement, defaults.implement),
    review: normalizeAgentModelTier(current?.review, defaults.review),
    audit: normalizeAgentModelTier(current?.audit, defaults.audit),
    simplifyReview: normalizeAgentModelTier(current?.simplifyReview, defaults.simplifyReview),
    tracker: normalizeAgentModelTier(current?.tracker, defaults.tracker)
  };
}

export function normalizeRuntimeModelHints(
  current: Record<string, unknown> | undefined
): Partial<Record<keyof RuntimeFlags, RuntimeModelHints>> | undefined {
  if (!current || typeof current !== "object") {
    return undefined;
  }

  const normalized: Partial<Record<keyof RuntimeFlags, RuntimeModelHints>> = {};
  for (const [runtime, hints] of Object.entries(current)) {
    if (!hints || typeof hints !== "object") {
      continue;
    }

    const tierHints: RuntimeModelHints = {};
    for (const tier of AGENT_MODEL_TIER_VALUES) {
      const modelId = (hints as Record<string, unknown>)[tier];
      if (typeof modelId === "string" && modelId.trim()) {
        tierHints[tier] = modelId.trim();
      }
    }

    if (Object.keys(tierHints).length > 0) {
      normalized[runtime as keyof RuntimeFlags] = tierHints;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeAgentsConfig(
  current: Partial<ProjectConfig["agents"]> | undefined,
  defaults: ProjectConfig["agents"]
): ProjectConfig["agents"] {
  const agents: ProjectConfig["agents"] = {
    modelTiers: normalizeAgentModelTiers({
      ...defaults.modelTiers,
      ...current?.modelTiers
    })
  };

  if (current?.markdown !== undefined) {
    agents.markdown = current.markdown;
  } else if (defaults.markdown !== undefined) {
    agents.markdown = defaults.markdown;
  }

  const runtimeModels =
    normalizeRuntimeModelHints(current?.runtimeModels as Record<string, unknown> | undefined) ??
    defaults.runtimeModels;
  if (runtimeModels !== undefined) {
    agents.runtimeModels = runtimeModels;
  }

  return agents;
}

export function tierForRole(config: ProjectConfig, role: AgentModelRole): AgentModelTier {
  return config.agents?.modelTiers?.[role] ?? DEFAULT_AGENT_MODEL_TIERS[role];
}

export function resolveRuntimeModelHint(
  config: ProjectConfig,
  runtime: keyof RuntimeFlags,
  tier: AgentModelTier
): string | undefined {
  return config.agents?.runtimeModels?.[runtime]?.[tier];
}

export function buildModelProfilesManifest(config: ProjectConfig): Record<string, unknown> {
  const tiers = normalizeAgentModelTiers(config.agents?.modelTiers);
  const runtimeModels = normalizeRuntimeModelHints(
    config.agents?.runtimeModels as Record<string, unknown> | undefined
  );

  const roles: Record<AgentModelRole, { tier: AgentModelTier; semantics: (typeof MODEL_TIER_SEMANTICS)[AgentModelTier] }> =
    {} as Record<AgentModelRole, { tier: AgentModelTier; semantics: (typeof MODEL_TIER_SEMANTICS)[AgentModelTier] }>;

  for (const role of AGENT_MODEL_ROLE_VALUES) {
    const tier = tiers[role];
    roles[role] = { tier, semantics: MODEL_TIER_SEMANTICS[tier] };
  }

  return {
    schemaVersion: 1,
    roles,
    runtimeModels: runtimeModels ?? {},
    enabledRuntimes: config.runtimes
  };
}

export function writeModelProfilesManifest(repoRoot: string, config: ProjectConfig): string {
  const manifestPath = path.join(repoRoot, MODEL_PROFILES_MANIFEST_PATH);
  ensureDir(path.dirname(manifestPath));
  writeTextFile(manifestPath, `${JSON.stringify(buildModelProfilesManifest(config), null, 2)}\n`);
  return manifestPath;
}
