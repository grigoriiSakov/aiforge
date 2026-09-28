import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

import YAML from "yaml";

import { writeTextFile } from "./filesystem.js";
import type { ProjectConfig, RuntimeFlags } from "./types.js";

const OBSOLETE_MANAGED_RULES = new Set([
  "Include focused tests and the full verification gate required before review.",
  "Require scoped tests and lint before review, then full verification after a clean review."
]);

export type OpenSpecToolId = "codex" | "cursor" | "claude" | "antigravity";

export function resolveOpenSpecTools(runtimes: RuntimeFlags): OpenSpecToolId[] {
  const tools: OpenSpecToolId[] = [];

  if (runtimes.codex) tools.push("codex");
  if (runtimes.cursor) tools.push("cursor");
  if (runtimes.claude) tools.push("claude");
  if (runtimes.agent) tools.push("antigravity");

  return tools;
}

export function ensureOpenSpecProject(
  repoRoot: string,
  config: ProjectConfig,
  options: { bin?: string } = {}
): void {
  const tools = resolveOpenSpecTools(config.runtimes);
  const args = [
    "init",
    repoRoot,
    "--tools",
    tools.length > 0 ? tools.join(",") : "none",
    "--profile",
    "core"
  ];
  const status = runOpenSpecCli(args, {
    cwd: repoRoot,
    ...(options.bin ? { bin: options.bin } : {})
  });

  if (status !== 0) {
    throw new Error(`OpenSpec init failed with exit code ${String(status)}`);
  }

  configureOpenSpecProject(repoRoot, config);
}

export function runOpenSpecCli(
  args: string[],
  options: { cwd?: string; bin?: string } = {}
): number {
  const override = options.bin ?? process.env.AIFORGE_OPENSPEC_BIN;
  const command = override
    ? { bin: override, args }
    : { bin: process.execPath, args: [resolveBundledOpenSpecBin(), ...args] };
  const result = spawnSync(command.bin, command.args, {
    cwd: options.cwd ?? process.cwd(),
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function configureOpenSpecProject(repoRoot: string, config: ProjectConfig): void {
  const configPath = path.join(repoRoot, "openspec", "config.yaml");
  const current = fs.existsSync(configPath)
    ? (YAML.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown> | null)
    : null;
  const next: Record<string, unknown> = current && typeof current === "object" ? { ...current } : {};
  next.schema = typeof next.schema === "string" ? next.schema : "spec-driven";
  next.context = upsertAiforgeContext(
    typeof next.context === "string" ? next.context : "",
    buildAiforgeContext(config)
  );
  const currentRules = isRecord(next.rules) ? next.rules : {};
  next.rules = mergeRules(currentRules, {
    proposal: ["State explicit non-goals.", "Identify affected behavior and specification domains."],
    specs: ["Use testable scenarios and SHALL or MUST for normative requirements."],
    design: ["Reuse existing architecture and document migration or rollback for risky changes."],
    tasks: [
      "Map every task to a requirement and a canonical aiforge verification command.",
      config.orchestrator.fullVerifyPolicy === "on-request"
        ? "Require affected tests and scoped lint before review; run full verification only on explicit user request."
        : "Require scoped tests and lint before review, then full verification after a clean review."
    ]
  });
  writeTextFile(configPath, YAML.stringify(next));
}

function buildAiforgeContext(config: ProjectConfig): string {
  return [
    "<aiforge>",
    `Project: ${config.project.name}`,
    `Profile: ${config.profile.id}`,
    `Workflow language: ${config.workflow.language}`,
    `Canonical implement command: ${config.execution.entrypoints.implement}`,
    `Canonical test command: ${config.execution.entrypoints.test}`,
    `Canonical lint command: ${config.execution.entrypoints.lint}`,
    `Canonical verify command: ${config.execution.entrypoints.verify}`,
    `Canonical review command: ${config.execution.entrypoints.review}`,
    "Follow AGENTS.md, MANIFESTO.md, and .ai/rules as binding execution constraints.",
    "</aiforge>"
  ].join("\n");
}

function upsertAiforgeContext(current: string, managed: string): string {
  const stripped = current.replace(/<aiforge>[\s\S]*?<\/aiforge>\s*/g, "").trim();
  return stripped ? `${stripped}\n\n${managed}` : managed;
}

function mergeRules(
  current: Record<string, unknown>,
  defaults: Record<string, string[]>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current };
  for (const [artifact, additions] of Object.entries(defaults)) {
    const existing = Array.isArray(current[artifact])
      ? current[artifact].filter(
          (value): value is string =>
            typeof value === "string" && !OBSOLETE_MANAGED_RULES.has(value)
        )
      : [];
    merged[artifact] = [...new Set([...existing, ...additions])];
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveBundledOpenSpecBin(): string {
  const require = createRequire(import.meta.url);
  const packageEntry = require.resolve("@fission-ai/openspec");
  const binPath = path.resolve(path.dirname(packageEntry), "../bin/openspec.js");
  if (!fs.existsSync(binPath)) {
    throw new Error(`Bundled OpenSpec CLI not found at \`${binPath}\`.`);
  }
  return binPath;
}
