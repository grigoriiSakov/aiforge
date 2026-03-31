import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("generic reusable surfaces", () => {
  test("template includes core generic commands, references, skills and codex wrappers", () => {
    const root = path.join(process.cwd(), "template", "base");

    const expectedPaths = [
      ".cursor/HIERARCHY.md.jinja",
      ".cursor/rules/workflow-gates.mdc.jinja",
      ".cursor/reference/context-budget.md.jinja",
      ".cursor/reference/issue-spec-template.md.jinja",
      ".cursor/reference/tracker-degraded-mode.md.jinja",
      ".cursor/commands/issue.md.jinja",
      ".cursor/commands/clarify.md.jinja",
      ".cursor/commands/check.md.jinja",
      ".cursor/commands/debug.md.jinja",
      ".cursor/commands/docs.md.jinja",
      ".cursor/commands/investigate.md.jinja",
      ".cursor/commands/refactor.md.jinja",
      ".cursor/commands/repeat.md.jinja",
      ".cursor/skills/planning/SKILL.md.jinja",
      ".cursor/skills/execution/SKILL.md.jinja",
      ".cursor/skills/review/SKILL.md.jinja",
      ".cursor/skills/debug/SKILL.md.jinja",
      ".cursor/skills/documentation/SKILL.md.jinja",
      ".cursor/skills/process-evolution/SKILL.md.jinja",
      ".cursor/skills/tracker/SKILL.md.jinja",
      ".codex/skills/aiforge-plan/SKILL.md.jinja",
      ".codex/skills/aiforge-build/SKILL.md.jinja",
      ".codex/skills/aiforge-review/SKILL.md.jinja"
    ];

    for (const relativePath of expectedPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    }
  });
});
