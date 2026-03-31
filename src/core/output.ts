import type { CommandResult } from "./types.js";

export function printResult(result: CommandResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${result.message}\n`);
  if (result.details) {
    process.stdout.write(`${JSON.stringify(result.details, null, 2)}\n`);
  }
}
