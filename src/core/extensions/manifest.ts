import fs from "node:fs";
import path from "node:path";

import { readJsonFileIfExists } from "../filesystem.js";

export interface ExtensionManifest {
  name: string;
  version: string;
  description?: string;
  /** Relative paths to skill directories (each containing SKILL.md). */
  skills?: string[];
}

function isSafeExtensionName(name: string): boolean {
  if (!name || name.length > 128) {
    return false;
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  return /^[a-zA-Z0-9_.@-]+$/.test(name);
}

export function readExtensionManifest(extensionRoot: string): ExtensionManifest {
  const manifestPath = path.join(extensionRoot, "extension.json");
  const raw = readJsonFileIfExists<unknown>(manifestPath);
  if (!raw || typeof raw !== "object" || raw === null) {
    throw new Error(`Missing or invalid extension.json at ${manifestPath}`);
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : "";
  const version = typeof obj.version === "string" ? obj.version : "";
  if (!isSafeExtensionName(name)) {
    throw new Error(`Invalid extension name: ${name}`);
  }
  if (!version) {
    throw new Error("extension.json requires non-empty version");
  }
  const skills = Array.isArray(obj.skills)
    ? obj.skills.filter((s): s is string => typeof s === "string")
    : undefined;
  return {
    name,
    version,
    ...(typeof obj.description === "string" ? { description: obj.description } : {}),
    ...(skills && skills.length > 0 ? { skills } : {})
  };
}

export function assertExtensionSourceLayout(extensionRoot: string, manifest: ExtensionManifest): void {
  const root = path.resolve(extensionRoot);
  for (const rel of manifest.skills ?? []) {
    const resolved = path.resolve(root, rel);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Unsafe skill path: ${rel}`);
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Skill path does not exist: ${rel}`);
    }
    if (!fs.statSync(resolved).isDirectory()) {
      throw new Error(`Skill path is not a directory: ${rel}`);
    }
    if (!fs.existsSync(path.join(resolved, "SKILL.md"))) {
      throw new Error(`Skill path missing SKILL.md: ${rel}`);
    }
  }
}
