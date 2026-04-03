import path from "node:path";

import { loadConfig } from "./config.js";
import { getProfileDefinition } from "./profiles/definitions.js";
import { writeTextFile } from "./filesystem.js";

export function generateManifesto(repoRoot: string): string {
  const config = loadConfig(repoRoot);
  const profile = getProfileDefinition(config.profile.id);
  const targetPath = path.join(repoRoot, config.manifesto.path);
  const content = config.manifesto.markdown?.trim()
    ? `${config.manifesto.markdown.trim()}\n`
    : `# ${config.manifesto.title}

## Project

- Name: ${config.project.name}
- Profile: ${config.profile.id}
- Main branch: ${config.project.mainBranch}
- Tracker: ${config.workflow.tracker}
- Tracker states: plan-ready=${config.workflow.trackerStates.planReady}, active=${config.workflow.trackerStates.active}, review=${config.workflow.trackerStates.review}

## Workflow

- Canonical phases: ${config.workflow.phases.join(" -> ")}
- Runtime surfaces: ${enabledRuntimes(config)}
- Orchestrator worktree root: ${config.orchestrator.worktreeRoot}
- Plan/progress local root: \`${config.artifacts.planProgressRoot}\` (per issue: \`{root}/ISSUE-ID/plan.md\`, \`{root}/ISSUE-ID/progress.md\`)

## Command Contract

- Build: \`${config.task.command} ${config.task.tasks.build}\`
- Test: \`${config.task.command} ${config.task.tasks.test}\`
- Lint: \`${config.task.command} ${config.task.tasks.lint}\`
- Verify: \`${config.task.command} ${config.task.tasks.verify}\`
- Review: \`${config.task.command} ${config.task.tasks.review}\`

## Profile Notes

${profile.notes.map((entry) => `- ${entry}`).join("\n")}
`;

  writeTextFile(targetPath, content);
  return targetPath;
}

function enabledRuntimes(config: ReturnType<typeof loadConfig>): string {
  const items = Object.entries(config.runtimes)
    .filter(([, enabled]) => enabled)
    .map(([runtime]) => runtime);
  return items.join(", ");
}
