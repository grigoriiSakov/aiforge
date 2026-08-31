import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function makeTempRepo(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function copyFixture(fixtureName: string): string {
  const sourcePath = path.join(process.cwd(), "tests", "fixtures", fixtureName);
  const tempPath = makeTempRepo(`ai-simple-${fixtureName}-`);
  fs.cpSync(sourcePath, tempPath, { recursive: true });
  return tempPath;
}

export function createFakeCopierBin(): string {
  const tempDir = makeTempRepo("ai-simple-copier-bin-");
  return createFakeExecutable(
    tempDir,
    "fake-copier",
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const mode = args[0];
const destinationPath = mode === "copy" ? args[args.length - 1] : process.cwd();
const manifestPath = path.join(destinationPath, ".ai", "project.manifest.json");
const ensureDir = (targetPath) => fs.mkdirSync(targetPath, { recursive: true });
const writeFile = (targetPath, content) => {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, content, "utf8");
};
const readManifest = () => {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
};

if (mode === "copy") {
  const templatePath = args[args.length - 2];
  const manifest = readManifest();
  const verifyCommands = Array.isArray(manifest?.commands?.verify) ? manifest.commands.verify : [];
  const projectRulesMarkdown =
    typeof manifest?.projectRules?.markdown === "string" ? manifest.projectRules.markdown.trim() : "";
  const agentsMarkdown = typeof manifest?.agents?.markdown === "string" ? manifest.agents.markdown.trim() : "";
  const projectProfileLines = [
    "# Project Profile Rule",
    "",
    "- Profile: \`" + String(manifest?.profile?.id ?? "unknown") + "\`",
    "- Tracker: \`" + String(manifest?.workflow?.tracker ?? "unknown") + "\`",
    "- Language: \`" + String(manifest?.workflow?.language ?? "unknown") + "\`",
    "",
    "## Verify Commands",
    ...verifyCommands.map((command) => "- \`" + String(command) + "\`")
  ];
  if (projectRulesMarkdown) {
    projectProfileLines.push("", "## Project-Specific Rules", "", projectRulesMarkdown);
  }
  const agentsBase =
    agentsMarkdown ||
    [
      "# AGENTS.md",
      "",
      "This repository uses the aiforge workflow baseline."
    ].join("\\n");
  const agentsContent = [
    agentsBase,
    "",
    "## Goal-Mode Multi-Task Contract",
    "",
    "- The Goal thread is manager-only and delegates one issue plus one OpenSpec change at a time.",
    "- Each worker uses one orchestrator worktree and openspec-apply-change <changeId>.",
    "- Use native subagents only; never shell-launch another agent CLI or poll a PTY."
  ].join("\\n");
  ensureDir(path.join(destinationPath, ".ai", "skills", "plan"));
  ensureDir(path.join(destinationPath, ".ai", "rules"));
  ensureDir(path.join(destinationPath, ".ai", "reference"));
  ensureDir(path.join(destinationPath, ".ai", "context"));
  ensureDir(path.join(destinationPath, ".cursor"));
  ensureDir(path.join(destinationPath, ".codex"));
  ensureDir(path.join(destinationPath, ".claude"));
  ensureDir(path.join(destinationPath, ".agent"));
  ensureDir(path.join(destinationPath, ".ai", "runtime"));
  writeFile(path.join(destinationPath, ".aiforge-version"), "0.1.0\\n");
  writeFile(path.join(destinationPath, "AGENTS.md"), agentsContent + "\\n");
  writeFile(path.join(destinationPath, "Taskfile.yml"), "version: \\"3\\"\\n");
  writeFile(path.join(destinationPath, ".codex", "hooks.json"), "{}\\n");
  writeFile(path.join(destinationPath, ".claude", "hooks.json"), "{}\\n");
  writeFile(
    path.join(destinationPath, ".ai", "skills", "plan", "SKILL.md"),
    "---\\nname: plan\\ndescription: Shared planning workflow.\\n---\\n\\n# Plan\\n"
  );
  writeFile(path.join(destinationPath, ".ai", "rules", "linear-mcp.mdc"), "# generated\\n");
  writeFile(path.join(destinationPath, ".ai", "rules", "project-profile.mdc"), projectProfileLines.join("\\n") + "\\n");
  writeFile(path.join(destinationPath, ".ai", "reference", "context-budget.md"), "# generated\\n");
  writeFile(path.join(destinationPath, ".ai", "reference", "PROMPT_OPTIMIZATION_STRATEGY.md"), "# generated\\n");
  writeFile(path.join(destinationPath, ".ai", "reference", "orchestrator-claimed-scope-template.md"), "# generated\\n");
  writeFile(path.join(destinationPath, ".ai", "context", "README.md"), "# generated\\n");
  writeFile(path.join(destinationPath, ".ai", "linear-scope.json"), "[]\\n");
  writeFile(path.join(destinationPath, ".cursor", "README.md"), "generated\\n");
  writeFile(path.join(destinationPath, ".cursor", "HIERARCHY.md"), "# generated\\n");
  writeFile(path.join(destinationPath, ".cursor", "settings.json"), "{\\"plugins\\":{\\"linear\\":{\\"enabled\\":true}}}\\n");
  writeFile(path.join(destinationPath, ".claude", "README.md"), "generated\\n");
  writeFile(path.join(destinationPath, ".agent", "README.md"), "generated\\n");
  writeFile(path.join(destinationPath, ".agents", "README.md"), "generated\\n");
  writeFile(path.join(destinationPath, ".ai", "runtime", "task-state.mjs"), "console.log('ok')\\n");
  writeFile(path.join(destinationPath, ".ai", "runtime", "review-state.mjs"), "console.log('ok')\\n");
  writeFile(path.join(destinationPath, ".ai", "runtime", "orchestrator-state.mjs"), "console.log('ok')\\n");
  writeFile(
    path.join(destinationPath, ".copier-answers.yml"),
    "_src_path: " + templatePath + "\\nproject_slug: fixture\\n"
  );
}

if (mode === "update") {
  writeFile(path.join(destinationPath, ".copier-update-marker"), "updated\\n");
}
`
  );
}

export function createFakeOpenSpecBin(): string {
  const tempDir = makeTempRepo("aiforge-openspec-bin-");
  return createFakeExecutable(
    tempDir,
    "fake-openspec",
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const repoRoot = args[1];
const writeFile = (relativePath, content) => {
  const targetPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
};
writeFile(".aiforge-openspec-invocation.json", JSON.stringify(args) + "\\n");
writeFile("openspec/config.yaml", "schema: spec-driven\\n");
writeFile(".ai/skills/openspec-propose/SKILL.md", "---\\nname: openspec-propose\\n---\\n");
writeFile(".cursor/commands/opsx-propose.md", "# Propose\\n");
process.exit(0);
`
  );
}

export function createFakeExecutable(directory: string, name: string, content: string): string {
  const binPath = path.join(directory, name);
  fs.writeFileSync(binPath, content, { mode: 0o755 });
  return binPath;
}

export function installReviewRuntime(repoRoot: string): void {
  const runtimeDir = path.join(repoRoot, ".ai", "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  const templateRoot = path.join(process.cwd(), "template", "base", ".ai", "runtime");
  for (const fileName of ["workspace-fingerprint.mjs", "task-state.mjs", "review-state.mjs"]) {
    fs.copyFileSync(
      path.join(templateRoot, `${fileName}.jinja`),
      path.join(runtimeDir, fileName)
    );
    fs.chmodSync(path.join(runtimeDir, fileName), 0o755);
  }

  fs.writeFileSync(
    path.join(runtimeDir, "task-state.json"),
    JSON.stringify({ history: [] }, null, 2) + "\n"
  );
}

export function installStopGuard(repoRoot: string): string {
  installCodexHookTemplates(repoRoot);
  return path.join(repoRoot, ".codex", "hooks", "stop-delivery-guard.mjs");
}

export function runNodeScript(scriptPath: string, args: string[], cwd: string): string {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Node script failed: ${scriptPath}`);
  }
  return result.stdout;
}

export function runNodeScriptWithInput(
  scriptPath: string,
  args: string[],
  cwd: string,
  input: string
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    input
  });

  return {
    status: result.status ?? 0,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

export function installCursorHookTemplates(repoRoot: string): void {
  const templateRoot = path.join(process.cwd(), "template", "base", ".cursor");
  const hookFiles = [
    "hooks.json.jinja",
    path.join("hooks", "session-init.mjs.jinja"),
    path.join("hooks", "audit.mjs.jinja"),
    path.join("hooks", "block-danger.mjs.jinja"),
    path.join("hooks", "render-context.mjs.jinja")
  ];

  for (const relativePath of hookFiles) {
    const sourcePath = path.join(templateRoot, relativePath);
    const targetPath = path.join(repoRoot, ".cursor", relativePath.replace(/\.jinja$/, ""));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, 0o755);
  }
}

export function installCodexHookTemplates(repoRoot: string): void {
  const templateRoot = path.join(process.cwd(), "template", "base", ".codex");
  const hookFiles = [
    "hooks.json.jinja",
    path.join("hooks", "pre-tool-use-guard.mjs.jinja"),
    path.join("hooks", "post-tool-use-guard.mjs.jinja"),
    path.join("hooks", "stop-delivery-guard.mjs.jinja")
  ];

  for (const relativePath of hookFiles) {
    const sourcePath = path.join(templateRoot, relativePath);
    const targetPath = path.join(repoRoot, ".codex", relativePath.replace(/\.jinja$/, ""));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, 0o755);
  }

  installWorkspaceFingerprintTemplate(repoRoot);
}

export function installClaudeHookTemplates(repoRoot: string): void {
  const templateRoot = path.join(process.cwd(), "template", "base", ".claude");
  const hookFiles = [
    "hooks.json.jinja",
    path.join("hooks", "pre-tool-use-guard.mjs.jinja"),
    path.join("hooks", "post-tool-use-guard.mjs.jinja"),
    path.join("hooks", "session-start-context.mjs.jinja"),
    path.join("hooks", "stop-delivery-guard.mjs.jinja")
  ];

  for (const relativePath of hookFiles) {
    const sourcePath = path.join(templateRoot, relativePath);
    const targetPath = path.join(repoRoot, ".claude", relativePath.replace(/\.jinja$/, ""));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, 0o755);
  }


  installWorkspaceFingerprintTemplate(repoRoot);
}

export function installWorkspaceFingerprintTemplate(repoRoot: string): void {
  const sourcePath = path.join(
    process.cwd(),
    "template",
    "base",
    ".ai",
    "runtime",
    "workspace-fingerprint.mjs.jinja"
  );
  const targetPath = path.join(repoRoot, ".ai", "runtime", "workspace-fingerprint.mjs");
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, 0o755);
}
