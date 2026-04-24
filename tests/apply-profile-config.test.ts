import { describe, expect, test } from "vitest";

import { applyProfileToConfig, createConfig } from "../src/core/config.js";

describe("applyProfileToConfig", () => {
  test("preserves linear scopes, workflow tracker, manifesto body when rebasing profile id", () => {
    const base = createConfig({
      repoRoot: "/tmp/r",
      projectSlug: "app",
      projectName: "App",
      profileId: "laravel-docker"
    });
    base.linear = {
      enabled: true,
      requireTrackerForIssueFlow: true,
      scopes: [
        {
          teamId: "4c644cd6-76e6-40b1-9119-d8906f08c705",
          team: "My Peak Backend",
          projectId: null,
          project: null,
          defaultLabels: ["backend"]
        }
      ]
    };
    base.workflow.tracker = "linear";
    base.manifesto.markdown = "## Architecture\n\n- Custom rule\n";
    base.manifesto.title = "Laravel Domain Workflow Manifesto";
    base.agents = { markdown: "- Agent note\n" };
    base.projectRules = { markdown: "- Rule one\n" };

    const next = applyProfileToConfig(base, "python-fastapi-docker");

    expect(next.profile.id).toBe("python-fastapi-docker");
    expect(next.linear).toEqual(base.linear);
    expect(next.workflow.tracker).toBe("linear");
    expect(next.manifesto.markdown).toBe("## Architecture\n\n- Custom rule\n");
    expect(next.manifesto.title).toBe("Laravel Domain Workflow Manifesto");
    expect(next.agents?.markdown).toBe("- Agent note\n");
    expect(next.projectRules?.markdown).toBe("- Rule one\n");
  });

  test("fills llms.sourceGlobs from profile when config has none", () => {
    const base = createConfig({
      repoRoot: "/tmp/r",
      projectSlug: "app",
      projectName: "App",
      profileId: "laravel-docker"
    });
    base.llms.sourceGlobs = [];

    const next = applyProfileToConfig(base, "python-fastapi-docker");
    expect(next.llms.sourceGlobs.length).toBeGreaterThan(0);
  });

  test("keeps user llms.sourceGlobs when non-empty", () => {
    const base = createConfig({
      repoRoot: "/tmp/r",
      projectSlug: "app",
      projectName: "App",
      profileId: "laravel-docker"
    });
    base.llms.sourceGlobs = ["custom/**/*.md"];

    const next = applyProfileToConfig(base, "python-fastapi-docker");
    expect(next.llms.sourceGlobs).toEqual(["custom/**/*.md"]);
  });

  test("same-profile apply keeps user command overrides", () => {
    const base = createConfig({
      repoRoot: "/tmp/r",
      projectSlug: "app",
      projectName: "App",
      profileId: "laravel-docker"
    });
    base.commands = {
      ...base.commands,
      test: ["bash scripts/custom-test.sh"]
    };

    const next = applyProfileToConfig(base, "laravel-docker");
    expect(next.commands.test).toEqual(["bash scripts/custom-test.sh"]);
  });

  test("profile switch replaces command templates with new profile defaults", () => {
    const base = createConfig({
      repoRoot: "/tmp/r",
      projectSlug: "app",
      projectName: "App",
      profileId: "laravel-docker"
    });
    base.commands = {
      ...base.commands,
      test: ["bash scripts/custom-test.sh"]
    };

    const next = applyProfileToConfig(base, "python-fastapi-docker");
    expect(next.commands.test).not.toEqual(["bash scripts/custom-test.sh"]);
    expect(next.commands.test?.[0]).toContain("docker");
  });
});
