import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { createConfig, saveConfig } from "../src/core/config.js";
import { installRemoteSkillFromGit } from "../src/core/remote-skills.js";
import { makeTempRepo } from "./helpers.js";

describe("remote skills", () => {
  test("rejects unsafe skill ids before cloning", () => {
    const repoRoot = makeTempRepo("aiforge-remote-skill-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });

    expect(() =>
      installRemoteSkillFromGit({
        repoRoot,
        config,
        gitUrl: "https://example.invalid/no-clone.git",
        skillId: "../../outside"
      })
    ).toThrow(/Invalid remote skill id/);
  });

  test("installs git skills without copying repository metadata", () => {
    const repoRoot = makeTempRepo("aiforge-remote-skill-target-");
    const config = createConfig({
      repoRoot,
      projectSlug: "demo",
      projectName: "Demo",
      profileId: "python-fastapi-docker"
    });
    saveConfig(repoRoot, config);

    const source = makeTempRepo("aiforge-remote-skill-src-");
    fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: remote\ndescription: test\n---\n", "utf8");
    execFileSync("git", ["init"], { cwd: source, stdio: "ignore" });
    execFileSync("git", ["add", "SKILL.md"], { cwd: source, stdio: "ignore" });
    execFileSync("git", ["-c", "user.email=test@example.invalid", "-c", "user.name=Test", "commit", "-m", "init"], {
      cwd: source,
      stdio: "ignore"
    });

    const result = installRemoteSkillFromGit({
      repoRoot,
      config,
      gitUrl: source,
      skillId: "team-skill"
    });

    expect(result.securityVerdict).toBe("clean");
    expect(fs.existsSync(path.join(repoRoot, ".ai", "skills", "team-skill", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, ".ai", "skills", "team-skill", ".git"))).toBe(false);
  });
});
