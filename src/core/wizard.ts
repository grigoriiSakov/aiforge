import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { DetectionResult, ProjectProfileId } from "./types.js";

const PROFILE_IDS: ProjectProfileId[] = [
  "python-fastapi-docker",
  "laravel-docker",
  "vue-quasar-capacitor"
];

export function parseProfileChoice(line: string): ProjectProfileId | null {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const byIndex = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(byIndex) && byIndex >= 1 && byIndex <= PROFILE_IDS.length) {
    return PROFILE_IDS[byIndex - 1] ?? null;
  }
  if (PROFILE_IDS.includes(trimmed as ProjectProfileId)) {
    return trimmed as ProjectProfileId;
  }
  return null;
}

export interface InitWizardAnswers {
  profileId?: ProjectProfileId;
  projectName?: string;
  /** Single-line starter; written to `manifesto.markdown` if non-empty */
  manifestoStub?: string;
  /** Single-line starter; written to `agents.markdown` */
  agentsStub?: string;
  /** Single-line starter; written to `projectRules.markdown` */
  projectRulesStub?: string;
}

/**
 * Minimal stdin prompts for `aiforge init/adopt --interactive`.
 */
export async function promptInitWizard(params: {
  repoSlug: string;
  detected: DetectionResult;
  /** When true, always ask for profile even if detection score > 0. */
  forceProfilePrompt?: boolean;
}): Promise<InitWizardAnswers> {
  const rl = readline.createInterface({ input, output, terminal: true });
  const answers: InitWizardAnswers = {};

  try {
    const needsProfile =
      params.forceProfilePrompt ||
      params.detected.score === 0 ||
      params.detected.confidence === "low";

    if (needsProfile) {
      output.write(
        [
          "Select profile:",
          ...PROFILE_IDS.map((id, i) => `  ${i + 1}) ${id}`),
          `Recommended from repo scan: ${params.detected.recommendedProfile} (score ${params.detected.score})`,
          "Enter number or profile id: "
        ].join("\n")
      );
      const profileLine = await rl.question("");
      const chosen = parseProfileChoice(profileLine);
      if (chosen) {
        answers.profileId = chosen;
      } else if (params.detected.score > 0) {
        answers.profileId = params.detected.recommendedProfile;
      }
    }

    output.write(`Project display name [${params.repoSlug}]: `);
    const nameLine = await rl.question("");
    const nameTrim = nameLine.trim();
    if (nameTrim.length > 0) {
      answers.projectName = nameTrim;
    }

    output.write("Add one-line starter text for manifesto / AGENTS / project rules? [y/N]: ");
    const contentGate = (await rl.question("")).trim().toLowerCase();
    if (contentGate === "y" || contentGate === "yes") {
      output.write("manifesto.markdown (one line, optional): ");
      const manifestoLine = (await rl.question("")).trim();
      if (manifestoLine.length > 0) {
        answers.manifestoStub = manifestoLine;
      }
      output.write("agents.markdown (one line, optional): ");
      const agentsLine = (await rl.question("")).trim();
      if (agentsLine.length > 0) {
        answers.agentsStub = agentsLine;
      }
      output.write("projectRules.markdown (one line, optional): ");
      const rulesLine = (await rl.question("")).trim();
      if (rulesLine.length > 0) {
        answers.projectRulesStub = rulesLine;
      }
    }
  } finally {
    rl.close();
  }

  return answers;
}
