# Runtime Surfaces

## Generated surfaces

- `.cursor/` — commands and rules
- `.codex/` — config and Codex hooks
- `.agent/` — Antigravity-facing surface
- `.agents/` — Codex agent-mode surface plus runtime manifest/state

## Important distinction

`.agents/` is not only a presentation surface.

In MVP it also stores:

- `.agents/project.manifest.json`
- `.agents/runtime/task-state.mjs`
- `.agents/runtime/task-state.json`

That is why runtime scripts and task instrumentation depend on `.agents/` even when the project does not actively use Codex agent mode prompts.
