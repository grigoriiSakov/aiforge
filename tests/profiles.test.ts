import { describe, expect, test } from "vitest";

import { detectProfile } from "../src/core/profiles/detect.js";
import { copyFixture } from "./helpers.js";

describe("profile detection", () => {
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

  test("detects vue-quasar-capacitor", () => {
    const repoRoot = copyFixture("vue-quasar-capacitor");
    const result = detectProfile(repoRoot);
    expect(result.recommendedProfile).toBe("vue-quasar-capacitor");
    expect(result.confidence).toBe("high");
  });
});
