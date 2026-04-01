import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { resolveTemplatePath } from "../src/core/template.js";

describe("generic reusable surfaces", () => {
  test("template path resolves to an existing directory", () => {
    expect(fs.existsSync(resolveTemplatePath())).toBe(true);
  });

  test("template includes shared rules, shared skills, and runtime references", () => {
    const root = path.join(process.cwd(), "template", "base");

    const expectedPaths = [
      ".cursor/HIERARCHY.md.jinja",
      ".ai/reference/context-budget.md.jinja",
      ".ai/reference/context-artifacts.md.jinja",
      ".ai/reference/issue-spec-template.md.jinja",
      ".ai/reference/PROMPT_OPTIMIZATION_STRATEGY.md.jinja",
      ".ai/reference/orchestrator-claimed-scope-template.md.jinja",
      ".ai/reference/plan-progress-template.md.jinja",
      ".ai/reference/plan-template.md.jinja",
      ".ai/reference/tracker-degraded-mode.md.jinja",
      ".ai/context/README.md.jinja",
      ".ai/linear-scope.json.jinja",
      ".ai/rules/workflow-gates.mdc.jinja",
      ".ai/rules/workflow.mdc.jinja",
      ".ai/rules/project-profile.mdc.jinja",
      ".ai/rules/linear-mcp.mdc.jinja",
      ".ai/skills/plan/SKILL.md.jinja",
      ".ai/skills/build/SKILL.md.jinja",
      ".ai/skills/review/SKILL.md.jinja",
      ".ai/skills/issue/SKILL.md.jinja",
      ".ai/skills/check/SKILL.md.jinja",
      ".ai/skills/debug/SKILL.md.jinja",
      ".ai/skills/docs/SKILL.md.jinja",
      ".ai/skills/tracker/SKILL.md.jinja",
      ".agents/runtime/orchestrator-state.mjs.jinja"
    ];

    for (const relativePath of expectedPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    }
  });
});
