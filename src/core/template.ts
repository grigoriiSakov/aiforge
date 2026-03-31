import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);

export function resolveTemplatePath(): string {
  return path.resolve(CURRENT_DIR, "../../template/base");
}

export function resolveRepoRoot(cwd: string): string {
  return path.resolve(cwd);
}
