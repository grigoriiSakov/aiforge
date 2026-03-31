import path from "node:path";

import fg from "fast-glob";

import { loadConfig } from "./config.js";
import { ensureDir, writeTextFile } from "./filesystem.js";

export async function buildLlms(repoRoot: string): Promise<string[]> {
  const config = loadConfig(repoRoot);
  const entries = await fg(config.llms.sourceGlobs, {
    cwd: repoRoot,
    dot: true,
    onlyFiles: true
  });

  const llmsRoot = path.join(repoRoot, config.llms.rootDir);
  ensureDir(llmsRoot);

  const readmePath = path.join(llmsRoot, "README.md");
  const txtPath = path.join(repoRoot, config.llms.txtPath);
  const indexPath = path.join(llmsRoot, "index.md");

  const bulletList = entries.length > 0 ? entries.map((entry) => `- \`${entry}\``).join("\n") : "- No matched files yet.";
  const txtContent = `# LLMs Index\n\nProject: ${config.project.name}\nProfile: ${config.profile.id}\n\n## Included paths\n\n${bulletList}\n`;
  const readmeContent = `# llms\n\nThis directory contains deterministic AI-facing index artifacts.\n\n## Source globs\n\n${config.llms.sourceGlobs.map((entry) => `- \`${entry}\``).join("\n")}\n`;
  const indexContent = `# llms index\n\n## Files\n\n${bulletList}\n`;

  writeTextFile(txtPath, txtContent);
  writeTextFile(readmePath, readmeContent);
  writeTextFile(indexPath, indexContent);

  return [txtPath, readmePath, indexPath];
}
