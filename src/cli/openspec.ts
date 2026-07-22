#!/usr/bin/env node

import process from "node:process";

import { runOpenSpecCli } from "../core/openspec.js";

try {
  process.exit(runOpenSpecCli(process.argv.slice(2)));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
