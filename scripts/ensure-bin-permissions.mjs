import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cliEntry = path.join(rootDir, "dist", "src", "cli", "index.js");

if (fs.existsSync(cliEntry)) {
  fs.chmodSync(cliEntry, 0o755);
}
