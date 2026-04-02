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
      ".ai/runtime/task-state.mjs.jinja",
      ".ai/runtime/review-state.mjs.jinja",
      ".ai/runtime/orchestrator-state.mjs.jinja"
    ];

    for (const relativePath of expectedPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    }
  });

  test("all shared skills require reading workflow rules first", () => {
    const root = path.join(process.cwd(), "template", "base", ".ai", "skills");
    const skillPaths = [
      "audit/SKILL.md.jinja",
      "build/SKILL.md.jinja",
      "check/SKILL.md.jinja",
      "clarify/SKILL.md.jinja",
      "debug/SKILL.md.jinja",
      "docs/SKILL.md.jinja",
      "investigate/SKILL.md.jinja",
      "issue/SKILL.md.jinja",
      "orchestrator/SKILL.md.jinja",
      "plan/SKILL.md.jinja",
      "process-evolution/SKILL.md.jinja",
      "refactor/SKILL.md.jinja",
      "repeat/SKILL.md.jinja",
      "review/SKILL.md.jinja",
      "tracker/SKILL.md.jinja"
    ];

    for (const relativePath of skillPaths) {
      const content = fs.readFileSync(path.join(root, relativePath), "utf8");
      expect(content).toContain("## Rule preflight");
      expect(content).toContain(".ai/rules/workflow.mdc");
      expect(content).toContain(".ai/rules/workflow-gates.mdc");
      expect(content).toContain(".ai/rules/project-profile.mdc");
      expect(content).toContain(".ai/context/current.md");
      expect(content).toContain("Treat those files as hard constraints");
    }
  });
});
