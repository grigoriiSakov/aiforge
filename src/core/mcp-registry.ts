/**
 * Built-in MCP provider templates (stdio). Keys match `ai.config.yaml` `mcp.placeholders` entries.
 * Uses `${VAR}` placeholders for secrets; agents resolve from environment.
 */

export const AIFORGE_MCP_SERVER_KEY_PREFIX = "aiforge-" as const;

export interface McpServerBlock {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpProviderDefinition {
  /** Human-readable id (matches placeholder after normalize). */
  id: string;
  block: McpServerBlock;
  /** Env vars that should be set for this server to work (doctor hints). */
  requiredEnv?: string[];
}

function normalizePlaceholder(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function sanitizeMcpKey(raw: string): string {
  const n = normalizePlaceholder(raw).replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return n.length > 0 ? n : "server";
}

const REGISTRY: Record<string, McpProviderDefinition> = {
  linear: {
    id: "linear",
    block: {
      command: "npx",
      args: ["-y", "mcp-remote", "https://mcp.linear.app/mcp"],
      env: {
        LINEAR_API_KEY: "${LINEAR_API_KEY}"
      }
    },
    requiredEnv: ["LINEAR_API_KEY"]
  },
  github: {
    id: "github",
    block: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
      }
    },
    requiredEnv: ["GITHUB_TOKEN"]
  },
  filesystem: {
    id: "filesystem",
    block: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  },
  postgres: {
    id: "postgres",
    block: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: {
        DATABASE_URL: "${DATABASE_URL}"
      }
    },
    requiredEnv: ["DATABASE_URL"]
  },
  playwright: {
    id: "playwright",
    block: {
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"]
    }
  },
  "chrome-devtools": {
    id: "chrome-devtools",
    block: {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"]
    }
  },
  "framework-docs": {
    id: "framework-docs",
    block: {
      command: "npx",
      args: ["-y", "@context7/mcp-server"]
    }
  },
  "project-db": {
    id: "project-db",
    block: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: {
        DATABASE_URL: "${DATABASE_URL}"
      }
    },
    requiredEnv: ["DATABASE_URL"]
  }
};

export function resolveMcpProvider(raw: string): McpProviderDefinition | null {
  const key = normalizePlaceholder(raw);
  if (key in REGISTRY) {
    return REGISTRY[key] ?? null;
  }
  return null;
}

export function listKnownMcpProviderIds(): string[] {
  return Object.keys(REGISTRY);
}

export function resolvePlaceholdersToBlocks(
  placeholders: string[]
): Array<{ placeholder: string; key: string; definition: McpProviderDefinition }> {
  const out: Array<{ placeholder: string; key: string; definition: McpProviderDefinition }> = [];
  const seen = new Set<string>();
  for (const raw of placeholders) {
    const def = resolveMcpProvider(raw);
    if (!def) {
      continue;
    }
    const key = sanitizeMcpKey(raw);
    const fullKey = `${AIFORGE_MCP_SERVER_KEY_PREFIX}${key}`;
    if (seen.has(fullKey)) {
      continue;
    }
    seen.add(fullKey);
    out.push({ placeholder: raw.trim(), key: fullKey, definition: def });
  }
  return out;
}
