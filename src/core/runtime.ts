import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config.js";

const RUNTIME_PATHS = {
  cursor: ".cursor",
  codex: ".codex",
  agent: ".agent"
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
}
