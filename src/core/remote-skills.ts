import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDir } from "./filesystem.js";
import { scanSkillTree } from "./security/gate.js";
import {
  loadInstallerStateOrNull,
  saveInstallerState,
  type AiforgeInstallerState,
  type AiforgeSecurityScanRecord
} from "./state.js";
import type { ProjectConfig } from "./types.js";

export interface InstallRemoteSkillResult {
  destRelative: string;
  securityVerdict: ReturnType<typeof scanSkillTree>["verdict"];
}

function isSafeRemoteSkillId(skillId: string): boolean {
  if (!skillId || skillId.length > 128) {
    return false;
  }
  if (skillId.includes("..") || skillId.includes("/") || skillId.includes("\\")) {
    return false;
  }
  return /^[a-zA-Z0-9_.@-]+$/.test(skillId);
}

function resolveSkillDestination(repoRoot: string, skillId: string): string {
  if (!isSafeRemoteSkillId(skillId)) {
    throw new Error(`Invalid remote skill id: ${skillId}`);
  }

  const skillsRoot = path.resolve(repoRoot, ".ai", "skills");
  const dest = path.resolve(skillsRoot, skillId);
  const rel = path.relative(skillsRoot, dest);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Unsafe remote skill id: ${skillId}`);
  }
  return dest;
}

function shouldCopyPackagePath(sourceRoot: string, sourcePath: string): boolean {
  const rel = path.relative(sourceRoot, sourcePath);
  if (!rel) {
    return true;
  }
  const parts = rel.split(path.sep);
  return !parts.some((part) => [".git", ".hg", ".svn", "node_modules"].includes(part));
}

function copyPackageTree(sourceRoot: string, dest: string): void {
  fs.cpSync(sourceRoot, dest, {
    recursive: true,
    filter: (sourcePath) => shouldCopyPackagePath(sourceRoot, sourcePath)
  });
}

function appendSecurityScan(state: AiforgeInstallerState, record: AiforgeSecurityScanRecord): AiforgeInstallerState {
  return {
    ...state,
    security: {
      lastScans: [...state.security.lastScans, record].slice(-50)
    }
  };
}

export function installRemoteSkillFromGit(params: {
  repoRoot: string;
  config: ProjectConfig;
  gitUrl: string;
  skillId: string;
}): InstallRemoteSkillResult {
  const dest = resolveSkillDestination(params.repoRoot, params.skillId);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiforge-remote-skill-"));
  try {
    execFileSync("git", ["clone", "--depth", "1", params.gitUrl, tmp], { stdio: "pipe" });
  } catch {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`git clone failed for ${params.gitUrl}`);
  }

  const scan = scanSkillTree(tmp);
  if (scan.verdict === "blocked") {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`Security scan blocked remote skill: ${scan.findings.join("; ")}`);
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  ensureDir(path.dirname(dest));
  copyPackageTree(tmp, dest);
  fs.rmSync(tmp, { recursive: true, force: true });

  const state = loadInstallerStateOrNull(params.repoRoot, params.config);
  if (!state) {
    throw new Error("Missing .aiforge.json; run aiforge sync first.");
  }
  const nextState = appendSecurityScan(
    {
      ...state,
      remoteSkills: [
        ...state.remoteSkills.filter((s) => s.id !== params.skillId),
        {
          id: params.skillId,
          source: "git",
          spec: params.gitUrl,
          versionOrHash: "HEAD",
          installedAt: new Date().toISOString()
        }
      ]
    },
    {
      artifact: `remote-skill:${params.skillId}`,
      verdict: scan.verdict === "warn" ? "warn" : "clean",
      at: new Date().toISOString(),
      ...(scan.findings.length ? { notes: scan.findings.join("; ") } : {})
    }
  );
  saveInstallerState(params.repoRoot, nextState);

  return { destRelative: path.relative(params.repoRoot, dest), securityVerdict: scan.verdict };
}

export function removeRemoteSkill(repoRoot: string, config: ProjectConfig, skillId: string): void {
  const dest = resolveSkillDestination(repoRoot, skillId);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  const state = loadInstallerStateOrNull(repoRoot, config);
  if (state) {
    saveInstallerState(repoRoot, {
      ...state,
      remoteSkills: state.remoteSkills.filter((s) => s.id !== skillId)
    });
  }
}
