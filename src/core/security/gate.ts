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

  const files = listFilesRecursive(rootDir).filter((f) => f.endsWith("SKILL.md") || f.endsWith(".md"));
  for (const file of files) {
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
