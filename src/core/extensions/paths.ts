import path from "node:path";

export const AIFORGE_DIR = ".aiforge";
export const AIFORGE_EXTENSIONS_DIR = path.join(AIFORGE_DIR, "extensions");

export function extensionInstallPath(repoRoot: string, extensionName: string): string {
  return path.join(repoRoot, AIFORGE_EXTENSIONS_DIR, extensionName);
}
