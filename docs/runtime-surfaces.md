# Runtime Surfaces

## Generated surfaces

- `.ai/` — shared source for reusable rules, skills, references, context artifacts, and tracker scope
- `.cursor/` — runtime-specific config, hooks, and symlinked views into `.ai/`
- `.codex/` — config, hooks, and symlinked views into `.ai/`
- `.agent/` — Antigravity-facing surface with symlinked views into `.ai/`
- `.agents/` — Codex agent-mode surface plus project manifest and symlinked skills

## Important distinction

`.agents/` is not only a presentation surface.

In MVP it also stores:

- `.ai/project.manifest.json`
- `.agents/skills -> ../.ai/skills`
- `.ai/runtime/task-state.mjs`
- `.ai/runtime/task-state.json`
- `.ai/runtime/review-state.mjs`
- `.ai/runtime/orchestrator-state.mjs`

Shared runtime scripts/state now live in `.ai/runtime`, because they must work across Cursor, Codex, `.agent`, and `.agents` equally. `.agents/` remains only the Codex agent-mode specific surface.
