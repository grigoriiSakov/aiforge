import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);

export function resolveTemplatePath(): string {
  const override = process.env.AI_SIMPLE_TEMPLATE_PATH;
  if (override) {
    const resolvedOverride = path.resolve(override);
    if (isDirectory(resolvedOverride)) {
      return resolvedOverride;
    }

    throw new Error(`Configured template path is not a directory: \`${resolvedOverride}\`.`);
  }

  const candidates = [
    path.resolve(CURRENT_DIR, "../../template/base"),
    path.resolve(CURRENT_DIR, "../../../template/base")
  ];

  for (const candidate of candidates) {
    if (isDirectory(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Template directory not found. Tried: ${candidates.map((candidate) => `\`${candidate}\``).join(", ")}`
  );
}

export function resolveRepoRoot(cwd: string): string {
  return path.resolve(cwd);
}

function isDirectory(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}
