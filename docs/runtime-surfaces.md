# Runtime Surfaces

## Generated surfaces

- `.ai/` — shared source for reusable rules, skills, operational references, context artifacts, and tracker scope
- `.cursor/` — runtime-specific config, hooks, and symlinked views into `.ai/`
- `.codex/` — config, hooks, and symlinked views into `.ai/`
- `.claude/` — Claude Code hooks and symlinked views into `.ai/`
- `.agent/` — Antigravity-facing surface with symlinked views into `.ai/`
- `.agents/` — thin Codex agent-mode surface
- `openspec/` — durable behavior specs and change artifacts consumed by every runtime

## What stays in `.agents`

- `.agents/skills -> ../.ai/skills`
- `.agents/README.md`

Everything shared or machine-readable now lives in `.ai`:

- `.ai/project.manifest.json`
- `.ai/runtime/*`
- `.ai/rules/*`
- `.ai/skills/*`
- `.ai/reference/*` (operational runtime references only; OpenSpec owns planning artifacts)
- `.ai/context/*`

So `.agents/` is now just an optional Codex agent-mode compatibility surface, not a shared source of truth.

OpenSpec installs its workflow skills through the enabled runtime adapters. Because runtime skill directories point to `.ai/skills`, the generated OpenSpec skills are shared without duplicating their content. Runtime-native command files, such as Cursor OPSX commands, remain in the directories expected by that runtime.

## Local boundary

- `.aiforge.local.yaml` — ignored machine/user overrides for worktree root, enabled runtimes, and concrete runtime model hints.
- `.aiforge.credentials.env` — ignored credentials plus project-specific environment/path overrides loaded by `aiforge doctor` and `.ai/bin/go-task`.
- `.aiforge.json` and `.copier-answers.yml` — ignored installer and Copier state.
- runtime MCP JSON, audit logs, task state, review verdicts, and orchestrator run state — ignored local state.

Secrets never enter `.ai/project.manifest.json` or `.ai/project.model-profiles.json`.
