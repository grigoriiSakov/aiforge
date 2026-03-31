# Runtime Surfaces

## Generated surfaces

- `.ai/` — shared source for reusable rules, skills, references, context artifacts, and tracker scope
- `.cursor/` — runtime-specific config, hooks, and symlinked views into `.ai/`
- `.codex/` — config, hooks, and symlinked views into `.ai/`
- `.agent/` — Antigravity-facing surface with symlinked views into `.ai/`
- `.agents/` — Codex agent-mode surface plus runtime manifest/state and symlinked skills

## Important distinction

`.agents/` is not only a presentation surface.

In MVP it also stores:

- `.agents/project.manifest.json`
- `.agents/skills -> ../.ai/skills`
- `.agents/runtime/task-state.mjs`
- `.agents/runtime/task-state.json`

That is why runtime scripts and task instrumentation depend on `.agents/` even when the project does not actively use Codex agent mode prompts.
