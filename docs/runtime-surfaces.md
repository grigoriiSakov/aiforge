# Runtime Surfaces

## Generated surfaces

- `.ai/` — shared source for reusable rules, skills, references, context artifacts, and tracker scope
- `.cursor/` — runtime-specific config, hooks, and symlinked views into `.ai/`
- `.codex/` — config, hooks, and symlinked views into `.ai/`
- `.claude/` — Claude Code hooks and symlinked views into `.ai/`
- `.agent/` — Antigravity-facing surface with symlinked views into `.ai/`
- `.agents/` — thin Codex agent-mode surface

## What stays in `.agents`

- `.agents/skills -> ../.ai/skills`
- `.agents/README.md`

Everything shared or machine-readable now lives in `.ai`:

- `.ai/project.manifest.json`
- `.ai/runtime/*`
- `.ai/rules/*`
- `.ai/skills/*`
- `.ai/reference/*`
- `.ai/context/*`

So `.agents/` is now just an optional Codex agent-mode compatibility surface, not a shared source of truth.
