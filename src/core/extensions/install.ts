import fs from "node:fs";
import path from "node:path";

import { ensureDir, writeTextFile } from "../filesystem.js";
import { scanSkillTree } from "../security/gate.js";
import {
  loadInstallerStateOrNull,
  saveInstallerState,
  type AiforgeExtensionRecord,
  type AiforgeInstallerState,
  type AiforgeSecurityScanRecord
} from "../state.js";
import type { ProjectConfig } from "../types.js";

import { extensionInstallPath, AIFORGE_EXTENSIONS_DIR } from "./paths.js";
import { assertExtensionSourceLayout, readExtensionManifest } from "./manifest.js";

function appendSecurityScan(state: AiforgeInstallerState, record: AiforgeSecurityScanRecord): AiforgeInstallerState {
  const lastScans = [...state.security.lastScans, record].slice(-50);
  return { ...state, security: { lastScans } };
}

export interface InstallExtensionResult {
  extensionName: string;
  installedSkills: string[];
  scan: ReturnType<typeof scanSkillTree>;
}

export function installExtensionFromPath(
  repoRoot: string,
  config: ProjectConfig,
  sourcePath: string
): InstallExtensionResult {
  const absSource = path.resolve(sourcePath);
  if (!fs.existsSync(absSource) || !fs.statSync(absSource).isDirectory()) {
    throw new Error(`Extension source is not a directory: ${absSource}`);
  }

  const manifest = readExtensionManifest(absSource);
  assertExtensionSourceLayout(absSource, manifest);

  const scan = scanSkillTree(absSource);
  if (scan.verdict === "blocked") {
    throw new Error(`Security scan blocked extension: ${scan.findings.join("; ")}`);
  }

  const destRoot = extensionInstallPath(repoRoot, manifest.name);
  fs.mkdirSync(path.join(repoRoot, AIFORGE_EXTENSIONS_DIR), { recursive: true });
  if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
  fs.cpSync(absSource, destRoot, { recursive: true });

  const installedSkills: string[] = [];
  const skillsRoot = path.join(repoRoot, ".ai", "skills");
  for (const rel of manifest.skills ?? []) {
    const srcSkill = path.join(absSource, rel);
    const base = path.basename(path.resolve(srcSkill));
    const destSkill = path.join(skillsRoot, `${manifest.name}__${base}`);
    if (fs.existsSync(destSkill)) {
      fs.rmSync(destSkill, { recursive: true, force: true });
    }
    ensureDir(path.dirname(destSkill));
    fs.cpSync(srcSkill, destSkill, { recursive: true });
    installedSkills.push(path.relative(repoRoot, destSkill));
  }

  const state = loadInstallerStateOrNull(repoRoot, config);
  if (!state) {
    throw new Error("Missing .aiforge.json; run aiforge sync first.");
  }
  const record: AiforgeExtensionRecord = {
    name: manifest.name,
    source: absSource,
    version: manifest.version,
    installedAt: new Date().toISOString()
  };
  const without = state.extensions.filter((e) => e.name !== manifest.name);
  let next: AiforgeInstallerState = {
    ...state,
    extensions: [...without, record]
  };
  next = appendSecurityScan(next, {
    artifact: `extension:${manifest.name}`,
    verdict: scan.verdict === "warn" ? "warn" : "clean",
    at: new Date().toISOString(),
    ...(scan.findings.length ? { notes: scan.findings.join("; ") } : {})
  });
  saveInstallerState(repoRoot, next);

  if (scan.verdict === "warn") {
    const warnPath = path.join(destRoot, "SECURITY_WARN.txt");
    writeTextFile(warnPath, `${scan.findings.join("\n")}\n`);
  }

  return { extensionName: manifest.name, installedSkills, scan };
}

export function removeExtension(repoRoot: string, config: ProjectConfig, extensionName: string): void {
  const destRoot = extensionInstallPath(repoRoot, extensionName);
  let manifestSkills: string[] = [];
  if (fs.existsSync(path.join(destRoot, "extension.json"))) {
    try {
      const m = readExtensionManifest(destRoot);
      manifestSkills = m.skills ?? [];
    } catch {
      manifestSkills = [];
    }
  }

  const skillsRoot = path.join(repoRoot, ".ai", "skills");
  for (const rel of manifestSkills) {
    const base = path.basename(path.resolve(path.join(destRoot, rel)));
    const destSkill = path.join(skillsRoot, `${extensionName}__${base}`);
    if (fs.existsSync(destSkill)) {
      fs.rmSync(destSkill, { recursive: true, force: true });
    }
  }

  if (fs.existsSync(destRoot)) {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }

  const state = loadInstallerStateOrNull(repoRoot, config);
  if (state) {
    saveInstallerState(repoRoot, {
      ...state,
      extensions: state.extensions.filter((e) => e.name !== extensionName)
    });
  }
}

export function updateExtensionFromPath(repoRoot: string, config: ProjectConfig, extensionName: string): void {
  const state = loadInstallerStateOrNull(repoRoot, config);
  const entry = state?.extensions.find((e) => e.name === extensionName);
  if (!entry) {
    throw new Error(`Extension not installed: ${extensionName}`);
  }
  if (!path.isAbsolute(entry.source)) {
    throw new Error("extension update is only supported for absolute local sources today");
  }
  if (!fs.existsSync(entry.source)) {
    throw new Error(`Extension source path missing: ${entry.source}`);
  }
  installExtensionFromPath(repoRoot, config, entry.source);
}
