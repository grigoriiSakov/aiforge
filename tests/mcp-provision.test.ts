import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { createConfig, saveConfig } from "../src/core/config.js";
import { provisionManagedMcp } from "../src/core/mcp-provision.js";
import { makeTempRepo } from "./helpers.js";

describe("MCP provisioning", () => {
  const originalLinearKey = process.env.LINEAR_API_KEY;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    restoreEnvironment("LINEAR_API_KEY", originalLinearKey);
    restoreEnvironment("DATABASE_URL", originalDatabaseUrl);
  });

  test("materializes local credentials only into ignored runtime MCP files", () => {
    delete process.env.LINEAR_API_KEY;
    delete process.env.DATABASE_URL;
    const repoRoot = makeTempRepo("aiforge-mcp-credentials-");
    const config = createConfig({
      repoRoot,
      projectSlug: "mcp-demo",
      projectName: "MCP Demo",
      profileId: "laravel-docker"
    });
    config.runtimes = { cursor: true, codex: false, claude: false, agent: false, agents: false };
    config.mcp.placeholders = ["linear", "project-db"];
    saveConfig(repoRoot, config);
    fs.writeFileSync(
      path.join(repoRoot, ".aiforge.credentials.env"),
      "LINEAR_API_KEY=local-linear-secret\nDATABASE_URL=postgresql://local-db-secret\n"
    );

    provisionManagedMcp(repoRoot, config);

    const runtimeConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, ".cursor", "mcp.json"), "utf8")
    ) as { mcpServers: Record<string, { env?: Record<string, string> }> };
    expect(runtimeConfig.mcpServers["aiforge-linear"]?.env?.LINEAR_API_KEY).toBe(
      "local-linear-secret"
    );
    expect(runtimeConfig.mcpServers["aiforge-project-db"]?.env?.DATABASE_URL).toBe(
      "postgresql://local-db-secret"
    );
    expect(fs.readFileSync(path.join(repoRoot, "ai.config.yaml"), "utf8")).not.toContain(
      "local-linear-secret"
    );
    expect(fs.readFileSync(path.join(repoRoot, ".ai", "project.manifest.json"), "utf8")).not.toContain(
      "local-db-secret"
    );
  });
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
