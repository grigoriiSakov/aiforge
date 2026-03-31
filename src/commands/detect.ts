import type { CommandResult } from "../core/types.js";
import { detectProfile } from "../core/profiles/detect.js";

export function runDetectCommand(repoRoot: string): CommandResult {
  const result = detectProfile(repoRoot);
  const ok = result.score > 0;
  return {
    ok,
    code: ok ? 0 : 3,
    message: ok
      ? `Recommended profile: ${result.recommendedProfile} (${result.confidence})`
      : "No confident profile match found. Pass --profile explicitly.",
    details: {
      recommendedProfile: result.recommendedProfile,
      confidence: result.confidence,
      score: result.score,
      reasons: result.reasons,
      facts: result.facts
    }
  };
}
