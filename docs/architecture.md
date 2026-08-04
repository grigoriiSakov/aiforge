# Architecture

## Runtime and Distribution

- Language: TypeScript on Node.js 20.19+
- Distribution target: npm package with the `aiforge` binary
- Spec/change engine: bundled OpenSpec CLI
- Template engine: Copier
- Command runner: repo-local Task wrapper at `.ai/bin/go-task`
- Primary target platforms: Linux and macOS

## Configuration Model

The durable project contract is `ai.config.yaml`.

Machine-readable mirrors are generated for tools that should not parse YAML:

- `.ai/project.manifest.json`
- `.ai/project.model-profiles.json`
- `.aiforge.json`

Precedence:

1. CLI flags
2. local config
3. selected profile defaults
4. template defaults

## Managed Surfaces

aiforge owns the workflow layer, not business code.

Managed surfaces include:

- `.ai/**`
- `.cursor/**`
- `.codex/**`
- `.claude/**`
- `.agent/**`
- `.agents/**`
- `AGENTS.md`
- `MANIFESTO.md`
- `Taskfile.yml`
- optional `llms.txt`
- optional `llms/**`

The target repository's application files remain unmanaged. They are read for detection and context, but not rewritten by aiforge.

## OpenSpec Boundary

OpenSpec owns durable planning state under `openspec/`: current behavior specs, proposed changes, design decisions, implementation tasks, validation, and archive history.

aiforge owns operational execution state under `.ai/`: canonical stack commands, worktree reservations, progress evidence, test and review gates, runtime adapters, MCP provisioning, model hints, and tracker transitions.

The shared post-Copier pipeline creates runtime symlinks first and then invokes the external `@fission-ai/openspec` runtime dependency non-interactively with the enabled runtime tool IDs. The `aiforge` package exports a thin `openspec` binary proxy; it does not copy, fork, or rewrite OpenSpec skills. This order lets official OpenSpec skills land in the shared `.ai/skills` source while runtime-specific command files remain in their native directories.

## Source Layout

- `src/cli` - command registration
- `src/commands` - command handlers
- `src/core/config.ts` - config lifecycle and template answers
- `src/core/profiles` - stack defaults and detection
- `src/core/copier.ts` - Copier integration
- `src/core/task-runner.ts` - repo-local Task wrapper and explicit opt-in installer
- `src/core/security` - extension and remote skill safety checks
- `template/base` - generated workflow surfaces
- `tests` - unit and integration coverage

## Command Flow

Mutating commands follow the same basic shape:

1. Resolve the target repository.
2. Load or create config.
3. Detect stack/runtime facts when needed.
4. Build the desired managed surface state.
5. Render through Copier.
6. Run post-steps such as machine manifest and Task wrapper generation.
7. Initialize or refresh OpenSpec skills and project context.
8. Report changes or diagnostics.

## Profile Strategy

Profiles provide practical defaults:

- detection hints
- task commands
- tracker defaults
- manifesto title
- LLM source globs
- short human notes

They are deliberately lightweight. If a real repository uses different commands, the intended override point is `ai.config.yaml`, not a forked template.

## Update Strategy

`sync` re-renders managed surfaces from the current installed template and current config.

`update` runs the Copier update flow when the template itself has changed.

Both commands preserve repository-local config fields for the same profile, including manifesto text, project rules, agent notes, model tiers, runtime model hints, and custom commands.

## Test Strategy

The test suite covers:

- profile detection
- config creation, normalization, migration, and validation
- command behavior in temporary repositories
- generated surface contracts
- orchestrator loop guards
- security gate behavior
- runtime/model hint helpers

CI runs:

- `npm run typecheck`
- `npm test`
- `npm run build`
