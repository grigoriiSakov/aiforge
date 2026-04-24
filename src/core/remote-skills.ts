import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDir } from "./filesystem.js";
import { scanSkillTree } from "./security/gate.js";
import { loadInstallerStateOrNull, saveInstallerState } from "./state.js";
import type { ProjectConfig } from "./types.js";

export interface InstallRemoteSkillResult {
  destRelative: string;
  securityVerdict: ReturnType<typeof scanSkillTree>["verdict"];
}

export function installRemoteSkillFromGit(params: {
  repoRoot: string;
  config: ProjectConfig;
  gitUrl: string;
  skillId: string;
}): InstallRemoteSkillResult {
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

  const dest = path.join(params.repoRoot, ".ai", "skills", params.skillId);
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  ensureDir(path.dirname(dest));
  fs.cpSync(tmp, dest, { recursive: true });
  fs.rmSync(tmp, { recursive: true, force: true });

  const state = loadInstallerStateOrNull(params.repoRoot, params.config);
  if (!state) {
    throw new Error("Missing .aiforge.json; run aiforge sync first.");
  }
  saveInstallerState(params.repoRoot, {
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
  });

  return { destRelative: path.relative(params.repoRoot, dest), securityVerdict: scan.verdict };
}

export function removeRemoteSkill(repoRoot: string, config: ProjectConfig, skillId: string): void {
  const dest = path.join(repoRoot, ".ai", "skills", skillId);
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
