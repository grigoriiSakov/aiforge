import fs from "node:fs";
import path from "node:path";

import { listFilesRecursive } from "../filesystem.js";

export type SecurityVerdict = "clean" | "warn" | "blocked";

export interface SecurityScanResult {
  verdict: SecurityVerdict;
  findings: string[];
}

const BLOCKED_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bignore\s+(all\s+)?(previous|prior)\s+instructions\b/i, label: "prompt-injection: ignore-instructions" },
  { re: /<\s*system\b/i, label: "fake-system-tags" },
  { re: /\brm\s+-rf\b/i, label: "destructive: rm-rf" },
  { re: /\bcurl\b[^;\n]*(\.env|\/\.ssh)/i, label: "exfiltration: curl-secrets" },
  { re: /\bdo\s+not\s+tell\s+the\s+user\b/i, label: "stealth-instructions" }
];

const WARN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bsecretly\b/i, label: "stealth-language" },
  { re: /\bbase64_decode\b/i, label: "encoded-payload-hint" }
];

const BLOCKED_FILE_NAMES = new Set([".env", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"]);
const BLOCKED_FILE_EXTENSIONS = new Set([".pem", ".p12", ".pfx", ".key"]);
const WARN_FILE_EXTENSIONS = new Set([".sh", ".bash", ".zsh", ".fish", ".ps1", ".py", ".js", ".mjs", ".cjs", ".ts"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IGNORED_PACKAGE_DIRS = new Set([".git", ".hg", ".svn", "node_modules"]);

function isExecutable(mode: number): boolean {
  return (mode & 0o111) !== 0;
}

function isBlockedFileName(relativePath: string): boolean {
  const base = path.basename(relativePath);
  const ext = path.extname(base).toLowerCase();
  return BLOCKED_FILE_NAMES.has(base) || BLOCKED_FILE_EXTENSIONS.has(ext);
}

function isWarnFileName(relativePath: string): boolean {
  return WARN_FILE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function isIgnoredPackagePath(relativePath: string): boolean {
  return relativePath.split(path.sep).some((part) => IGNORED_PACKAGE_DIRS.has(part));
}

/**
 * Lightweight static scan for SKILL.md / markdown content (Level-1 style gate).
 * Not a substitute for full sandbox review.
 */
export function scanMarkdownContent(filePath: string, content: string): SecurityScanResult {
  const findings: string[] = [];
  for (const { re, label } of BLOCKED_PATTERNS) {
    if (re.test(content)) {
      findings.push(`${label} in ${filePath}`);
    }
  }
  if (findings.length > 0) {
    return { verdict: "blocked", findings };
  }
  for (const { re, label } of WARN_PATTERNS) {
    if (re.test(content)) {
      findings.push(`${label} in ${filePath}`);
    }
  }
  if (findings.length > 0) {
    return { verdict: "warn", findings };
  }
  return { verdict: "clean", findings: [] };
}

export function scanSkillTree(rootDir: string): SecurityScanResult {
  const allFindings: string[] = [];
  let worst: SecurityVerdict = "clean";
  const files = listFilesRecursive(rootDir).filter((file) => !isIgnoredPackagePath(path.relative(rootDir, file)));
  const hasSkillFile = files.some((file) => path.basename(file) === "SKILL.md");

  if (!hasSkillFile) {
    worst = "blocked";
    allFindings.push("missing-skill-md: package must contain at least one SKILL.md");
  }

  for (const file of files) {
    const stat = fs.lstatSync(file);
    const rel = path.relative(rootDir, file);
    if (stat.isSymbolicLink()) {
      worst = "blocked";
      allFindings.push(`unsafe-symlink in ${rel}`);
      continue;
    }
    if (isBlockedFileName(rel)) {
      worst = "blocked";
      allFindings.push(`sensitive-file in ${rel}`);
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) {
      worst = "blocked";
      allFindings.push(`oversized-file in ${rel}`);
      continue;
    }
    if (isWarnFileName(rel) && worst !== "blocked") {
      worst = "warn";
      allFindings.push(`script-file in ${rel}`);
    }
    if (isExecutable(stat.mode) && worst !== "blocked") {
      worst = "warn";
      allFindings.push(`executable-file in ${rel}`);
    }
  }

  if (worst === "blocked") {
    return { verdict: worst, findings: allFindings };
  }

  const markdownFiles = files.filter((f) => f.endsWith("SKILL.md") || f.endsWith(".md"));
  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(rootDir, file);
    const res = scanMarkdownContent(rel, content);
    if (res.verdict === "blocked") {
      worst = "blocked";
      allFindings.push(...res.findings);
    } else if (res.verdict === "warn" && worst !== "blocked") {
      worst = "warn";
      allFindings.push(...res.findings);
    }
  }

  return { verdict: worst, findings: allFindings };
}
