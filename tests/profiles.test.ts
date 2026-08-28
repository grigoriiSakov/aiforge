import { describe, expect, test } from "vitest";

import { detectProfile } from "../src/core/profiles/detect.js";
import { PROFILE_DEFINITIONS } from "../src/core/profiles/definitions.js";
import { copyFixture } from "./helpers.js";

describe("profile detection", () => {
  test("every profile has explicit scoped commands and semantic-only review", () => {
    for (const profile of Object.values(PROFILE_DEFINITIONS)) {
      expect(profile.taskCommands.testScoped.length).toBeGreaterThan(0);
      expect(profile.taskCommands.lintScoped.length).toBeGreaterThan(0);
      expect(profile.taskCommands.testScoped.join(" ")).toContain("{{.CLI_ARGS}}");
      expect(profile.taskCommands.lintScoped.join(" ")).toContain("{{.CLI_ARGS}}");
      expect(profile.taskCommands.review.join(" ")).not.toContain("verify");
    }
  });

  test("detects python-fastapi-docker", () => {
    const repoRoot = copyFixture("python-fastapi-docker");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("python-fastapi-docker");
    expect(result.confidence).toBe("high");
  });

  test("detects laravel-docker", () => {
    const repoRoot = copyFixture("laravel-docker");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("laravel-docker");
    expect(result.confidence).toBe("high");
  });

  test("detects python-django", () => {
    const repoRoot = copyFixture("python-django");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("python-django");
    expect(result.confidence).toBe("high");
  });

  test("detects node-express-api", () => {
    const repoRoot = copyFixture("node-express-api");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("node-express-api");
    expect(result.confidence).toBe("high");
  });

  test("detects nextjs", () => {
    const repoRoot = copyFixture("nextjs");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("nextjs");
    expect(result.confidence).toBe("high");
  });

  test("detects react-vite", () => {
    const repoRoot = copyFixture("react-vite");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("react-vite");
    expect(result.confidence).toBe("high");
  });

  test("detects vue-quasar-capacitor", () => {
    const repoRoot = copyFixture("vue-quasar-capacitor");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("vue-quasar-capacitor");
    expect(result.confidence).toBe("high");
  });

  test("detects go-service", () => {
    const repoRoot = copyFixture("go-service");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("go-service");
    expect(result.confidence).toBe("high");
  });
});
