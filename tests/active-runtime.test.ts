import { describe, expect, test } from "vitest";

import {
  delegationInstruction,
  detectActiveRuntime,
  validateModelSlugForRuntime
} from "../src/core/active-runtime.js";

describe("active-runtime", () => {
  test("detects codex before cursor when codex env is set", () => {
    expect(
      detectActiveRuntime({
        CODEX_ENV: "1",
        CURSOR_AGENT: "1"
      })
    ).toBe("codex");
  });

  test("AIFORGE_ACTIVE_RUNTIME overrides heuristics", () => {
    expect(
      detectActiveRuntime({
        AIFORGE_ACTIVE_RUNTIME: "codex",
        CURSOR_TRACE_ID: "x"
      })
    ).toBe("codex");
  });

  test("rejects cursor-style slug for codex runtime", () => {
    const result = validateModelSlugForRuntime("codex", "gpt-5.5-medium");
    expect(result.model).toBeNull();
    expect(result.rejectedReason).toContain("Cursor");
  });

  test("accepts codex cli slug", () => {
    const result = validateModelSlugForRuntime("codex", "gpt-5.4-mini");
    expect(result.model).toBe("gpt-5.4-mini");
  });

  test("codex instruction never mentions Task tool", () => {
    const text = delegationInstruction("codex", "budget", "gpt-5.4-mini");
    expect(text).toContain("codex -m");
    expect(text).not.toContain("Task tool");
  });

  test("cursor instruction uses Task tool", () => {
    const text = delegationInstruction("cursor", "budget", "gpt-5-mini");
    expect(text).toContain("Task tool");
  });
});
