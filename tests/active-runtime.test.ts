import { describe, expect, test } from "vitest";

import {
  delegationInstruction,
  detectActiveRuntime,
  validateModelSlugForRuntime
} from "../src/core/active-runtime.js";

describe("active-runtime", () => {
  test("detects Codex Goal sessions before competing host markers", () => {
    expect(
      detectActiveRuntime({
        CODEX_THREAD_ID: "thread-123",
        CURSOR_AGENT: "1",
        CLAUDECODE: "1"
      })
    ).toBe("codex");
    expect(detectActiveRuntime({ CODEX_CI: "1" })).toBe("codex");
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

  test("accepts a Codex model slug", () => {
    const result = validateModelSlugForRuntime("codex", "gpt-5.4-mini");
    expect(result.model).toBe("gpt-5.4-mini");
  });

  test("codex instruction requires native delegation without recursive CLI", () => {
    const text = delegationInstruction("codex", "budget", "gpt-5.6-terra");
    expect(text).toContain("native subagent");
    expect(text).toContain("Never run codex exec");
    expect(text).not.toContain("codex -m");
  });

  test("cursor instruction uses Task tool", () => {
    const text = delegationInstruction("cursor", "budget", "gpt-5-mini");
    expect(text).toContain("Task tool");
  });
});
