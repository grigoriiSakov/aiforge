# Architecture

## Core idea

`ai-simple-template` intentionally keeps the product thin:

- `Copier` renders managed surfaces through local apply runs;
- `Taskfile.yml` hides project-specific commands behind stable task names;
- generated hooks and prompts read machine-friendly project data from `.ai/project.manifest.json`.

## Layers

### CLI

`src/cli/index.ts`

Thin orchestration layer over:

- profile detection,
- config bootstrap,
- Copier-based local render/apply,
- manifesto/llms/mcp post-processing,
- diagnostics.

### Core services

- `src/core/config.ts`
- `src/core/state.ts` (`.aiforge.json`)
- `src/core/setup.ts` / `src/core/wizard.ts`
- `src/core/profiles/*`
- `src/core/copier.ts`
- `src/core/doctor.ts`
- `src/core/manifesto.ts`
- `src/core/llms.ts`
- `src/core/mcp.ts`, `src/core/mcp-registry.ts`, `src/core/mcp-provision.ts`
- `src/core/extensions/*`, `src/core/remote-skills.ts`, `src/core/security/gate.ts`

### Template surface

`template/base`

Contains generated files for target repos:

- `.cursor`
- `.codex`
- `.claude`
- `.agent`
- `.agents`
- `AGENTS.md`
- `Taskfile.yml`
- `MANIFESTO.md`
- `llms`

### Profiles

Profile defaults live in TypeScript definitions and docs:

- `python-fastapi-docker`
- `laravel-docker`
- `vue-quasar-capacitor`

## Config flow

1. CLI detects a likely profile.
2. CLI creates `ai.config.yaml`.
3. CLI also writes `.ai/project.manifest.json` for runtime hooks.
4. CLI writes/merges `.aiforge.json` (installer state: runtimes mirror, MCP/extension/skill metadata).
5. CLI converts config into Copier answers.
6. Copier renders target surfaces.
7. Post-processing (`finalizeAfterCopierCopy`): task runner, Copier answers, runtime symlinks, `MANIFESTO.md`, `llms`, MCP merge + docs.

## Installer state (`.aiforge.json`)

Implemented in `src/core/state.ts`. Updated from:

- `writeMachineManifest` / `saveConfig` (runtimes mirror + timestamps),
- `provisionManagedMcp` (managed MCP hashes under `state.mcp`),
- `extension add/remove/update` and `skills add-git/remove` (extensions / remoteSkills arrays).

`src/core/doctor.ts` validates presence and runtime parity between YAML and `.aiforge.json`.

## MCP provisioning

- Registry: `src/core/mcp-registry.ts`
- Merge/write: `src/core/mcp-provision.ts`
- User-facing scaffold + README: `src/core/mcp.ts`

Managed servers use JSON keys prefixed with `aiforge-` inside `mcpServers` objects.

## Why `.ai/project.manifest.json`

Generated runtime scripts must not depend on npm packages from the configurator repo.

So:

- humans read/edit `ai.config.yaml`;
- hooks and runtime scripts read JSON from `.ai/project.manifest.json`.
