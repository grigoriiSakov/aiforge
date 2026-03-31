import fs from "node:fs";
import path from "node:path";

export function ensureDir(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true });
}

export function writeTextFile(targetPath: string, content: string): void {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, content, "utf8");
}

export function readTextFileIfExists(targetPath: string): string | null {
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  return fs.readFileSync(targetPath, "utf8");
}

export function readJsonFileIfExists<T>(targetPath: string): T | null {
  const content = readTextFileIfExists(targetPath);
  if (!content) {
    return null;
  }

  return JSON.parse(content) as T;
}

export function listFilesRecursive(rootPath: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFilesRecursive(fullPath));
    } else {
      output.push(fullPath);
    }
  }

  return output;
}

export function hasFile(rootPath: string, relativePath: string): boolean {
  return fs.existsSync(path.join(rootPath, relativePath));
}
