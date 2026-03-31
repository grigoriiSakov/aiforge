import fs from "node:fs";
import path from "node:path";

import type { LinearScope, ProjectConfig } from "./types.js";

export const LINEAR_SCOPE_FILE = path.join(".cursor", "linear-scope.json");
export const CURSOR_SETTINGS_FILE = path.join(".cursor", "settings.json");

export function writeLinearScopeFile(repoRoot: string, scopes: LinearScope[]): string {
  const targetPath = path.join(repoRoot, LINEAR_SCOPE_FILE);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(scopes, null, 2)}\n`, "utf8");
  return targetPath;
}

export function writeCursorSettingsFile(repoRoot: string, linearEnabled: boolean): string {
  const targetPath = path.join(repoRoot, CURSOR_SETTINGS_FILE);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const existing = fs.existsSync(targetPath)
    ? (JSON.parse(fs.readFileSync(targetPath, "utf8")) as Record<string, unknown>)
    : {};

  const next = {
    ...existing,
    plugins: {
      ...(isRecord(existing.plugins) ? existing.plugins : {}),
      linear: {
        enabled: linearEnabled
      }
    }
  };

  fs.writeFileSync(targetPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return targetPath;
}

export function applyLinearPrimaryScope(
  config: ProjectConfig,
  scope: {
    team: string;
    teamId?: string;
    project?: string;
    projectId?: string;
    defaultLabels?: string[];
  }
): ProjectConfig {
  const nextScope: LinearScope = {
    teamId: scope.teamId ?? null,
    team: scope.team,
    projectId: scope.projectId ?? null,
    project: scope.project ?? null,
    defaultLabels: scope.defaultLabels ?? []
  };

  return {
    ...config,
    workflow: {
      ...config.workflow,
      tracker: "linear"
    },
    linear: {
      enabled: true,
      requireTrackerForIssueFlow: true,
      scopes: [nextScope]
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
