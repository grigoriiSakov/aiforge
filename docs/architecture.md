# Architecture

## Core idea

`ai-simple-template` intentionally keeps the product thin:

- `Copier` renders managed surfaces through local apply runs;
- `Taskfile.yml` hides project-specific commands behind stable task names;
- generated hooks and prompts read machine-friendly project data from `.agents/project.manifest.json`.

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
- `src/core/profiles/*`
- `src/core/copier.ts`
- `src/core/doctor.ts`
- `src/core/manifesto.ts`
- `src/core/llms.ts`
- `src/core/mcp.ts`

### Template surface

`template/base`

Contains generated files for target repos:

- `.cursor`
- `.codex`
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
3. CLI also writes `.agents/project.manifest.json` for runtime hooks.
4. CLI converts config into Copier answers.
5. Copier renders target surfaces.
6. Post-processing regenerates `MANIFESTO.md`, `llms`, MCP placeholders.

## Why `.agents/project.manifest.json`

Generated runtime scripts must not depend on npm packages from the configurator repo.

So:

- humans read/edit `ai.config.yaml`;
- hooks and runtime scripts read JSON from `.agents/project.manifest.json`.
