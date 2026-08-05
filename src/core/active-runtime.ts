import type { RuntimeFlags } from "./types.js";

export const AGENT_RUNTIME_IDS = ["cursor", "codex", "claude", "agent", "agents"] as const;
export type AgentRuntimeId = (typeof AGENT_RUNTIME_IDS)[number];

/** Slugs that belong to Cursor Task / UI naming, not the Codex model namespace. */
const CURSOR_ONLY_SLUG = /^(auto|composer[\w.-]*|gpt-5\.5-(medium|fast)|claude-opus-4-8-thinking-high)$/i;

/** Slugs that belong to the Codex model namespace, not Cursor. */
const CODEX_ONLY_SLUG = /^gpt-5\.3-codex/i;

export function isAgentRuntimeId(value: string): value is AgentRuntimeId {
  return (AGENT_RUNTIME_IDS as readonly string[]).includes(value);
}

/**
 * Best-effort detection of which agent host is running this process.
 * Override with AIFORGE_ACTIVE_RUNTIME or AIFORGE_RUNTIME_PROVIDER.
 */
export function detectActiveRuntime(env: NodeJS.ProcessEnv = process.env): AgentRuntimeId | null {
  const explicit = env.AIFORGE_ACTIVE_RUNTIME?.trim().toLowerCase();
  if (explicit && isAgentRuntimeId(explicit)) {
    return explicit;
  }

  const provider = env.AIFORGE_RUNTIME_PROVIDER?.trim().toLowerCase();
  if (provider && isAgentRuntimeId(provider)) {
    return provider;
  }

  // Codex before Cursor — some environments expose both; prefer Codex-specific signals.
  if (env.CODEX_THREAD_ID || env.CODEX_CI || env.CODEX_SANDBOX || env.CODEX_ENV || env.CODEX_ROOT) {
    return "codex";
  }

  if (env.CLAUDECODE || env.CLAUDE_CODE) {
    return "claude";
  }

  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT || env.CURSOR_SESSION_ID) {
    return "cursor";
  }

  return null;
}

export function validateModelSlugForRuntime(
  runtime: AgentRuntimeId,
  slug: string | null | undefined
): { model: string | null; rejectedReason: string | null } {
  const normalized = String(slug ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "auto") {
    return { model: null, rejectedReason: normalized ? "reserved-ui-mode" : "empty-slug" };
  }

  if (runtime === "codex" && (CURSOR_ONLY_SLUG.test(normalized) || /\bmedium\b|\bfast\b/i.test(normalized))) {
    return {
      model: null,
      rejectedReason: `slug "${normalized}" looks like a Cursor model id; use Codex model ids under agents.runtimeModels.codex`
    };
  }

  if (runtime === "cursor" && CODEX_ONLY_SLUG.test(normalized)) {
    return {
      model: null,
      rejectedReason: `slug "${normalized}" is Codex-specific; use agents.runtimeModels.cursor`
    };
  }

  return { model: normalized, rejectedReason: null };
}

export function delegationInstruction(
  runtime: AgentRuntimeId,
  tier: string,
  model: string | null
): string {
  if (runtime === "cursor") {
    return model
      ? `Cursor native subagent preference: model="${model}" when the Task tool supports it. Never shell-launch another agent CLI.`
      : `Cursor native subagent: use an inherited compatible model for tier ${tier}. Never shell-launch another agent CLI.`;
  }

  if (runtime === "codex") {
    return model
      ? `Codex native subagent preference: model="${model}" when native delegation supports selection; otherwise inherit a compatible model and record the fallback. Never run codex exec or poll a PTY.`
      : `Codex native subagent: inherit a compatible model for tier ${tier}. Never read agents.runtimeModels.cursor, run codex exec, or poll a PTY.`;
  }

  if (runtime === "claude") {
    return model
      ? `Claude native subagent preference: model="${model}" when supported. Never shell-launch another agent CLI.`
      : `Claude native subagent: use an inherited compatible model for tier ${tier}. Never shell-launch another agent CLI.`;
  }

  return `Runtime ${runtime}, tier ${tier}${model ? `, model ${model}` : ""}. Use only native subagent tools and agents.runtimeModels.${runtime}.`;
}

export function pickEnabledRuntime(
  runtimes: RuntimeFlags,
  requested: AgentRuntimeId | null
): AgentRuntimeId | null {
  if (requested && runtimes[requested]) {
    return requested;
  }

  const detected = detectActiveRuntime();
  if (detected && runtimes[detected]) {
    return detected;
  }

  for (const id of AGENT_RUNTIME_IDS) {
    if (runtimes[id]) {
      return id;
    }
  }

  return null;
}
