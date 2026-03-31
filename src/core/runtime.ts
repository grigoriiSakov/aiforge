import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config.js";
import type { RuntimeFlags } from "./types.js";

const RUNTIME_PATHS = {
  cursor: ".cursor",
  codex: ".codex",
  agent: ".agent",
  agents: ".agents"
} as const;

const SHARED_SKILLS_PATH = path.join(".ai", "skills");
const SHARED_RULES_PATH = path.join(".ai", "rules");
const SHARED_REFERENCE_PATH = path.join(".ai", "reference");
const SHARED_CONTEXT_PATH = path.join(".ai", "context");

const SKILL_LINK_RUNTIMES = {
  cursor: ".cursor",
  codex: ".codex",
  agent: ".agent",
  agents: ".agents"
} as const;

const RULE_LINK_RUNTIMES = {
  cursor: ".cursor",
  codex: ".codex",
  agent: ".agent"
} as const;

const REFERENCE_LINK_RUNTIMES = {
  cursor: ".cursor"
} as const;

const CONTEXT_LINK_RUNTIMES = {
  cursor: ".cursor"
} as const;

export function applyRuntimeFlags(repoRoot: string): void {
  const config = loadConfig(repoRoot);

  for (const [runtime, relativePath] of Object.entries(RUNTIME_PATHS)) {
    const enabled = config.runtimes[runtime as keyof typeof config.runtimes];
    const absolutePath = path.join(repoRoot, relativePath);
    if (!enabled && fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    }
  }

  removeLegacyManagedSurfaces(repoRoot);
  ensureSharedLinks(repoRoot, config.runtimes);
}

function removeLegacyManagedSurfaces(repoRoot: string): void {
  fs.rmSync(path.join(repoRoot, ".cursor", "commands"), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, ".cursor", "reference"), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, ".cursor", "context"), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, ".cursor", "linear-scope.json"), { recursive: true, force: true });
  fs.rmSync(path.join(repoRoot, ".cursor", "PROMPT_OPTIMIZATION_STRATEGY.md"), { recursive: true, force: true });
}

function ensureSharedLinks(repoRoot: string, runtimes: RuntimeFlags): void {
  ensureSharedDirectoryLinks(repoRoot, SHARED_SKILLS_PATH, "skills", SKILL_LINK_RUNTIMES, runtimes);
  ensureSharedDirectoryLinks(repoRoot, SHARED_RULES_PATH, "rules", RULE_LINK_RUNTIMES, runtimes);
  ensureSharedDirectoryLinks(repoRoot, SHARED_REFERENCE_PATH, "reference", REFERENCE_LINK_RUNTIMES, runtimes);
  ensureSharedDirectoryLinks(repoRoot, SHARED_CONTEXT_PATH, "context", CONTEXT_LINK_RUNTIMES, runtimes);
}

function ensureSharedDirectoryLinks<T extends Record<string, string>>(
  repoRoot: string,
  sharedRelativePath: string,
  leafName: string,
  runtimeDirectories: T,
  runtimes: RuntimeFlags
): void {
  const sharedAbsolutePath = path.join(repoRoot, sharedRelativePath);
  if (!fs.existsSync(sharedAbsolutePath)) {
    return;
  }

  for (const [runtime, runtimeDir] of Object.entries(runtimeDirectories)) {
    if (!runtimes[runtime as keyof RuntimeFlags]) {
      continue;
    }

    const runtimeRoot = path.join(repoRoot, runtimeDir);
    if (!fs.existsSync(runtimeRoot)) {
      continue;
    }

    const linkPath = path.join(runtimeRoot, leafName);
    const linkTarget = path.relative(path.dirname(linkPath), sharedAbsolutePath);
    if (fs.existsSync(linkPath)) {
      const linkStat = fs.lstatSync(linkPath);
      if (linkStat.isSymbolicLink() && fs.readlinkSync(linkPath) === linkTarget) {
        continue;
      }

      fs.rmSync(linkPath, { recursive: true, force: true });
    }

    fs.symlinkSync(linkTarget, linkPath, process.platform === "win32" ? "junction" : "dir");
  }
}
