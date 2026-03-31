import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ProjectConfig } from "./types.js";

interface SnapshotMetadata {
  rootDir: string;
  entries: Array<{
    relativePath: string;
    existed: boolean;
  }>;
}

export function createManagedSnapshot(repoRoot: string, config: ProjectConfig): SnapshotMetadata {
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-simple-snapshot-"));
  const entries = config.managedSurfaces.map((surface) => {
    const absolutePath = path.join(repoRoot, surface.path);
    const existed = fs.existsSync(absolutePath);
    if (existed) {
      const targetPath = path.join(snapshotRoot, surface.path);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(absolutePath, targetPath, { recursive: true });
    }
    return { relativePath: surface.path, existed };
  });

  return { rootDir: snapshotRoot, entries };
}

export function restoreManagedSnapshot(repoRoot: string, snapshot: SnapshotMetadata): void {
  for (const entry of snapshot.entries) {
    const absolutePath = path.join(repoRoot, entry.relativePath);
    fs.rmSync(absolutePath, { recursive: true, force: true });
    if (entry.existed) {
      const sourcePath = path.join(snapshot.rootDir, entry.relativePath);
      if (fs.existsSync(sourcePath)) {
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.cpSync(sourcePath, absolutePath, { recursive: true });
      }
    }
  }
}

export function cleanupSnapshot(snapshot: SnapshotMetadata): void {
  fs.rmSync(snapshot.rootDir, { recursive: true, force: true });
}
