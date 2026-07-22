import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cliEntries = [
  path.join(rootDir, "dist", "src", "cli", "index.js"),
  path.join(rootDir, "dist", "src", "cli", "openspec.js")
];

for (const cliEntry of cliEntries) {
  if (fs.existsSync(cliEntry)) {
    fs.chmodSync(cliEntry, 0o755);
  }
}
