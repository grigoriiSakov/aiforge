# Feature Scope

## Product Goal

aiforge helps teams add a consistent AI-agent workflow layer to new or existing repositories in minutes.

It does not try to generate application code. It standardizes the process surfaces that agents rely on: OpenSpec changes, rules, skills, task commands, review gates, runtime hooks, context files, and MCP scaffolding.

## Problems It Solves

Without a shared workflow layer, every repository slowly grows its own mix of prompt files, IDE-specific rules, undocumented task commands, and stale agent instructions.

aiforge gives a repository one source of truth:

- `ai.config.yaml` for durable workflow configuration
- managed `.ai/**` files for shared rules and skills
- runtime adapters for Cursor, Codex, Claude Code, and related agent surfaces
- task entrypoints that agents and humans can both run
- update and sync commands so the workflow can evolve safely
- bundled OpenSpec for durable requirements, change proposals, designs, tasks, validation, and archive history

## MVP Scope

Core commands:

- `init` - create a managed workflow baseline
- `adopt` - bring an existing repository under aiforge management
- `detect` - inspect stack signals and recommend a profile
- `sync` - render managed surfaces from the current config
- `update` - apply template/runtime evolution
- `doctor` - check drift, missing dependencies, and runtime state
- `mcp scaffold` - create or update managed MCP blocks
- `manifesto init` - create the initial manifesto surface
- `llms build` - rebuild optional `llms.txt` and `llms/**` when `features.llms` is enabled
- `project-stub` - generate a prompt-friendly project configuration draft

Supported starter profiles:

- `python-fastapi-docker`
- `python-django`
- `laravel-docker`
- `node-express-api`
- `nextjs`
- `react-vite`
- `vue-quasar-capacitor`
- `go-service`

## Success Criteria

- A repository can get a working baseline in under five minutes.
- `detect -> init/adopt -> doctor` gives a clear path to a usable setup.
- Managed surfaces can be regenerated without hand-copying instructions between tools.
- Stack-specific defaults are useful but easy to override in `ai.config.yaml`.
- Tests and typecheck pass in CI.

## Non-Goals

- Managing application dependencies.
- Migrating business code.
- Replacing CI.
- Deep semantic merge of arbitrary local edits in managed files.
- Acting as a marketplace for third-party agents or plugins.
- Reimplementing OpenSpec's specification and change lifecycle.

## Current Risks

- Profiles are opinionated and may need repository-specific command overrides.
- Windows support is not a first-class target yet.
- Generated workflow surfaces are powerful, but still evolving with real usage.
- Template updates need careful review in repositories with heavy local customization.
