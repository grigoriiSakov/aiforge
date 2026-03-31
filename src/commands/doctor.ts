import { runDoctor } from "../core/doctor.js";
import type { CommandResult } from "../core/types.js";

export function runDoctorCommand(repoRoot: string): CommandResult {
  return runDoctor(repoRoot);
}
