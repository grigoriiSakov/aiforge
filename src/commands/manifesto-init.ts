import { generateManifesto } from "../core/manifesto.js";
import type { CommandResult } from "../core/types.js";

export function runManifestoInitCommand(repoRoot: string, dryRun = false): CommandResult {
  if (dryRun) {
    return {
      ok: true,
      code: 0,
      message: "Dry-run manifesto init completed",
      details: { wouldWrite: ["MANIFESTO.md"] }
    };
  }

  const targetPath = generateManifesto(repoRoot);
  return {
    ok: true,
    code: 0,
    message: "MANIFESTO.md generated",
    details: { targetPath }
  };
}
