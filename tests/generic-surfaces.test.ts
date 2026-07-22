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
      ".claude/README.md.jinja",
      ".claude/hooks.json.jinja",
      ".claude/hooks/pre-tool-use-guard.mjs.jinja",
      ".claude/hooks/post-tool-use-guard.mjs.jinja",
      ".claude/hooks/session-start-context.mjs.jinja",
      ".claude/hooks/stop-delivery-guard.mjs.jinja",
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
      ".ai/skills/skeptic/SKILL.md.jinja",
      ".ai/skills/implement/SKILL.md.jinja",
      ".ai/skills/review/SKILL.md.jinja",
      ".ai/skills/issue/SKILL.md.jinja",
      ".ai/skills/supervisor/SKILL.md.jinja",
      ".ai/skills/check/SKILL.md.jinja",
      ".ai/skills/debug/SKILL.md.jinja",
      ".ai/skills/docs/SKILL.md.jinja",
      ".ai/skills/tracker/SKILL.md.jinja",
      ".ai/runtime/task-state.mjs.jinja",
      ".ai/runtime/review-state.mjs.jinja",
      ".ai/runtime/orchestrator-state.mjs.jinja",
      ".ai/runtime/supervisor-state.mjs.jinja",
      ".ai/runtime/supervisor-context.mjs.jinja",
      ".ai/runtime/supervisor-daemon.mjs.jinja",
      ".ai/runtime/supervisor-linear-sync.mjs.jinja",
      ".ai/runtime/supervisor-launchers/headless.mjs.jinja",
      ".ai/runtime/supervisor-launchers/cursor.mjs.jinja",
      ".ai/runtime/supervisor-launchers/claude.mjs.jinja",
      ".ai/runtime/supervisor-launchers/codex.mjs.jinja"
    ];

    for (const relativePath of expectedPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    }
  });

  test("all shared skills require reading workflow rules first", () => {
    const root = path.join(process.cwd(), "template", "base", ".ai", "skills");
    const skillPaths = [
      "audit/SKILL.md.jinja",
      "implement/SKILL.md.jinja",
      "check/SKILL.md.jinja",
      "clarify/SKILL.md.jinja",
      "debug/SKILL.md.jinja",
      "docs/SKILL.md.jinja",
      "investigate/SKILL.md.jinja",
      "initiative/SKILL.md.jinja",
      "supervisor/SKILL.md.jinja",
      "issue/SKILL.md.jinja",
      "orchestrator/SKILL.md.jinja",
      "plan/SKILL.md.jinja",
      "skeptic/SKILL.md.jinja",
      "process-evolution/SKILL.md.jinja",
      "refactor/SKILL.md.jinja",
      "repeat/SKILL.md.jinja",
      "review/SKILL.md.jinja",
      "simplify-review/SKILL.md.jinja",
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

  test("plan uses an OpenSpec change as its sole planning source of truth", () => {
    const planSkill = fs.readFileSync(
      path.join(process.cwd(), "template", "base", ".ai", "skills", "plan", "SKILL.md.jinja"),
      "utf8"
    );

    expect(planSkill).toContain("The selected `openspec/changes/<change-id>/` directory is the sole planning source of truth.");
    expect(planSkill).toContain("Do not create a new `PLAN::ISSUE-ID` artifact");
    expect(planSkill).toContain("openspec validate <change-id>");
  });

  test("implementation and orchestration consume OpenSpec planning artifacts", () => {
    const skillsRoot = path.join(process.cwd(), "template", "base", ".ai", "skills");
    const implementSkill = fs.readFileSync(path.join(skillsRoot, "implement", "SKILL.md.jinja"), "utf8");
    const orchestratorSkill = fs.readFileSync(path.join(skillsRoot, "orchestrator", "SKILL.md.jinja"), "utf8");

    expect(implementSkill).toContain("openspec instructions apply --change <change-id>");
    expect(implementSkill).toContain("openspec/changes/<change-id>/");
    expect(orchestratorSkill).toContain("plan memory: `openspec/changes/<change-id>/`");
    expect(orchestratorSkill).toContain("openspec validate <change-id>");
  });

  test("skeptic and review validate the selected OpenSpec change", () => {
    const skillsRoot = path.join(process.cwd(), "template", "base", ".ai", "skills");
    const skepticSkill = fs.readFileSync(path.join(skillsRoot, "skeptic", "SKILL.md.jinja"), "utf8");
    const reviewSkill = fs.readFileSync(path.join(skillsRoot, "review", "SKILL.md.jinja"), "utf8");

    expect(skepticSkill).toContain("selected `openspec/changes/<change-id>/`");
    expect(reviewSkill).toContain("selected `openspec/changes/<change-id>/`");
    expect(reviewSkill).toContain("openspec validate <change-id>");
  });

  test("workflow rules use OpenSpec instead of the legacy local plan contract", () => {
    const rulesRoot = path.join(process.cwd(), "template", "base", ".ai", "rules");
    const workflow = fs.readFileSync(path.join(rulesRoot, "workflow.mdc.jinja"), "utf8");
    const gates = fs.readFileSync(path.join(rulesRoot, "workflow-gates.mdc.jinja"), "utf8");

    expect(workflow).toContain("openspec/changes/<change-id>/");
    expect(workflow).not.toContain("PLAN::ISSUE-ID");
    expect(gates).toContain("validated OpenSpec change");
    expect(gates).not.toContain("Spec Coverage Matrix");
  });

  test("supervisor worker and review contexts point to OpenSpec changes", () => {
    const runtimeRoot = path.join(process.cwd(), "template", "base", ".ai", "runtime");
    const state = fs.readFileSync(path.join(runtimeRoot, "supervisor-state.mjs.jinja"), "utf8");
    const context = fs.readFileSync(path.join(runtimeRoot, "supervisor-context.mjs.jinja"), "utf8");

    expect(state).toContain('path.join("openspec", "changes", openSpecChangeId(issueId))');
    expect(context).toContain("OpenSpec change: openspec/changes/${openSpecChangeId(issue.id)}");
    expect(context).not.toContain("Plan path:");
  });

  test("OpenSpec sync and archive run only at the orchestrator terminal gate", () => {
    const skillsRoot = path.join(process.cwd(), "template", "base", ".ai", "skills");
    const implementSkill = fs.readFileSync(path.join(skillsRoot, "implement", "SKILL.md.jinja"), "utf8");
    const orchestratorSkill = fs.readFileSync(path.join(skillsRoot, "orchestrator", "SKILL.md.jinja"), "utf8");

    expect(implementSkill).toContain("Use `/opsx:update <change-id>` when implementation changes the approved artifacts");
    expect(implementSkill).toContain("Do not run `/opsx:sync` or archive the change from `/implement`");
    expect(orchestratorSkill).toContain("## OpenSpec terminal gate");
    expect(orchestratorSkill).toContain("`/opsx:sync <change-id>`");
    expect(orchestratorSkill).toContain("`openspec archive <change-id> --yes`");
    expect(orchestratorSkill).toContain("Do not release the orchestrator run when sync or archive fails");
  });

  test("README documents the default OpenSpec workflow", () => {
    const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");

    expect(readme).toContain("OpenSpec is installed and initialized by default");
    expect(readme).toContain("/opsx:propose");
    expect(readme).toContain("aiforge owns execution");
  });

  test("Taskfile.yml.jinja must not use Jinja trim that eats YAML list indentation", () => {
    const taskfilePath = path.join(process.cwd(), "template", "base", "Taskfile.yml.jinja");
    const content = fs.readFileSync(taskfilePath, "utf8");
    // `-%}` after `for` strips indent before `- {{ command }}` -> invalid cmds entries.
    // `{% endfor -%}` strips indent before the following `post` line when loops are empty.
    expect(content).not.toMatch(/\{%\s*for[^%]*-\s*%\}/);
    expect(content).not.toMatch(/\{%\s*endfor\s*-\s*%\}/);
  });

  test("SKILL.md.jinja must not use trailing trim on if/else/endif around indented markdown sublists", () => {
    const skillsRoot = path.join(process.cwd(), "template", "base", ".ai", "skills");
    for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillMd = path.join(skillsRoot, entry.name, "SKILL.md.jinja");
      if (!fs.existsSync(skillMd)) {
        continue;
      }
      const content = fs.readFileSync(skillMd, "utf8");
      // `-%}` after `if linear_enabled` / `else` / `endif` can strip the indent before `   -` nested bullets.
      expect(content).not.toMatch(/\{%\s*if\s+linear_enabled\s*-\s*%\}/);
      expect(content).not.toMatch(/\{%\s*else\s*-\s*%\}/);
      expect(content).not.toMatch(/\{%\s*endif\s*-\s*%\}/);
    }
  });

  test("implement and review enforce explicit project rules compliance", () => {
    const root = path.join(process.cwd(), "template", "base");
    const implementSkill = fs.readFileSync(
      path.join(root, ".ai", "skills", "implement", "SKILL.md.jinja"),
      "utf8"
    );
    const reviewSkill = fs.readFileSync(path.join(root, ".ai", "skills", "review", "SKILL.md.jinja"), "utf8");
    const projectProfile = fs.readFileSync(path.join(root, ".ai", "rules", "project-profile.mdc.jinja"), "utf8");
    const progressTemplate = fs.readFileSync(
      path.join(root, ".ai", "reference", "plan-progress-template.md.jinja"),
      "utf8"
    );

    expect(implementSkill).toContain("## Project rules compliance (mandatory)");
    expect(implementSkill).toContain("## Project Rules Compliance");
    expect(reviewSkill).toContain("## Project rules compliance check (mandatory)");
    expect(reviewSkill).toContain("### Project Rules Compliance");
    expect(projectProfile).toContain("## Enforcement (mandatory for implement and review)");
    expect(progressTemplate).toContain("## Project Rules Compliance");
  });

  test("testing policy defaults to touched scope, not full suite", () => {
    const root = path.join(process.cwd(), "template", "base");
    const workflowGates = fs.readFileSync(path.join(root, ".ai", "rules", "workflow-gates.mdc.jinja"), "utf8");
    const implementSkill = fs.readFileSync(
      path.join(root, ".ai", "skills", "implement", "SKILL.md.jinja"),
      "utf8"
    );
    const reviewSkill = fs.readFileSync(path.join(root, ".ai", "skills", "review", "SKILL.md.jinja"), "utf8");
    const checkSkill = fs.readFileSync(path.join(root, ".ai", "skills", "check", "SKILL.md.jinja"), "utf8");

    expect(workflowGates).toContain("By default, test only the touched behavior/scope");
    expect(workflowGates).toContain("Do not run the full project test suite unless");
    expect(implementSkill).toContain("default to the smallest credible test scope");
    expect(reviewSkill).toContain("default expectation is scoped tests for the behavior that changed");
    expect(checkSkill).toContain("Do not assume the full project test suite is required");
  });

  test("orchestrator chooses simple or full review by complexity", () => {
    const root = path.join(process.cwd(), "template", "base");
    const orchestratorSkill = fs.readFileSync(
      path.join(root, ".ai", "skills", "orchestrator", "SKILL.md.jinja"),
      "utf8"
    );
    const reviewSkill = fs.readFileSync(path.join(root, ".ai", "skills", "review", "SKILL.md.jinja"), "utf8");

    expect(orchestratorSkill).toContain("review-depth triage");
    expect(orchestratorSkill).toContain("review_depth: simple|full");
    expect(orchestratorSkill).toContain("запрещено запускать одновременно `simple` и `full` review");
    expect(reviewSkill).toContain("Honor parent-provided `review_depth: simple|full`");
    expect(reviewSkill).toContain("Escalate to `full` immediately");
    expect(reviewSkill).toContain("review_depth: simple | full");
  });
});
