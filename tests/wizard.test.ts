import { describe, expect, test } from "vitest";

import { parseProfileChoice } from "../src/core/wizard.js";

describe("parseProfileChoice", () => {
  test("accepts 1-based index", () => {
    expect(parseProfileChoice("2")).toBe("laravel-docker");
  });

  test("accepts profile id", () => {
    expect(parseProfileChoice("vue-quasar-capacitor")).toBe("vue-quasar-capacitor");
  });

  test("returns null for garbage", () => {
    expect(parseProfileChoice("nope")).toBeNull();
    expect(parseProfileChoice("")).toBeNull();
  });
});
