# aiforge

aiforge installs a practical AI-agent workflow layer into real software repositories.

It gives Cursor, Codex, Claude Code, and similar agent runtimes the same project rules, task commands, review gates, context files, and runtime guards. The goal is simple: make agent work repeatable without turning every repository into a pile of hand-maintained prompt files.

## Project Status

aiforge is an early MVP. It is useful, tested, and intentionally opinionated, but the configuration format and generated surfaces may still evolve.

Current focus:

- bootstrap or adopt existing repositories
- keep AI-facing rules in one managed place
- provide stack-aware defaults for common projects
- support safe `sync` and `update` flows as the template improves

## What It Creates

aiforge adds a managed workflow kernel to a target repository:

| Surface | Purpose |
|---------|---------|
| `ai.config.yaml` | The source of truth for project workflow, profile, runtimes, commands, and model tiers |
| `.ai/**` | Shared rules, skills, operational references, context files, and runtime state helpers |
| `AGENTS.md`, `MANIFESTO.md` | Human-readable project instructions generated from `ai.config.yaml` |
| `.cursor/**`, `.codex/**`, `.claude/**`, `.agent/**`, `.agents/**` | Runtime-specific adapters and hooks |
| `Taskfile.yml` | Canonical task entrypoints used by humans and agents |
| `llms.txt`, `llms/**` | Optional LLM context output |
| `.aiforge.json` | Installer state for MCP, extensions, remote skills, and runtime checks |
| `openspec/**` | Durable behavior specifications, proposed changes, designs, and implementation tasks |

Business code is not generated or rewritten.

## OpenSpec Workflow

OpenSpec is a runtime dependency of `aiforge` and is initialized by default during `init`, `adopt`, `sync`, and `update`; there is no opt-in flag and no separate OpenSpec package installation is required. Installing or linking `aiforge` publishes both the `aiforge` and `openspec` commands. Existing global installations of `aiforge` must be updated or linked again once to create the new `openspec` executable shim; `aiforge sync` intentionally does not modify global package-manager state.

Responsibilities are deliberately split:

- OpenSpec owns durable requirements and planning through `/opsx:explore`, `/opsx:propose`, change specs, design, tasks, validation, sync, and archive.
- aiforge owns execution: stack profiles, canonical Task commands, runtime guards, worktrees, progress state, tests, review gates, MCP, model routing, and tracker transitions.
- `/plan` is an aiforge compatibility bridge that creates or updates an OpenSpec change. New local `PLAN::ISSUE-ID` artifacts are no longer created.
- `/implement` and `/orchestrator` consume one validated `openspec/changes/<change-id>/` while keeping runtime evidence in `.ai/context/runtime/<issue-id>/progress.md`.

Start a change with:

```text
/opsx:propose "describe the change"
```

For a multi-change initiative, start one host Goal and give it the ordered issue/change manifest. The Goal thread manages dependencies and integration; it delegates one `issue + changeId` at a time through native subagents. Each worker runs the repository orchestrator in its own worktree and uses `openspec-apply-change` for implementation. Recursive agent CLI launches, PTY polling, and a separate project manager daemon are not part of the workflow.

## Supported Profiles

Profiles are starter defaults, not hard locks. After `init` or `adopt`, edit `ai.config.yaml` if a repository has different commands.

| Profile | Best for |
|---------|----------|
| `python-fastapi-docker` | Docker-first FastAPI backends |
| `python-django` | Django apps and APIs |
| `laravel-docker` | Laravel applications validated inside Docker |
| `node-express-api` | Node.js API services using npm scripts |
| `nextjs` | Next.js product applications |
| `react-vite` | React frontends powered by Vite |
| `vue-quasar-capacitor` | Vue, Quasar, and Capacitor apps |
| `go-service` | Go services using the standard Go toolchain |

## Requirements

Required on the machine running aiforge:

- Node.js 20.19 or newer
- npm
- Python 3 with Copier available as either `copier` or `python3 -m copier`

Useful depending on the target repository:

- Docker / Docker Compose for Docker-based profiles
- Go, Python, PHP/Composer, npm/yarn/pnpm, or the stack toolchain used by the selected profile
- Task (`go-task`) is optional. aiforge writes a repo-local wrapper at `.ai/bin/go-task`. If no system `go-task` or `task` binary exists, install Task yourself, set `AIFORGE_TASK_INSTALLER_BIN`, or explicitly opt into download with `AIFORGE_ALLOW_TASK_DOWNLOAD=1`.

Install Copier:

```bash
python3 -m pip install --user copier
# or with pipx
pipx install copier
```

## Install

### From npm

Use this once a public package is published:

```bash
npm install -g aiforge
aiforge --help
```

### From source

```bash
git clone https://github.com/grigoriiSakov/aiforge.git
cd aiforge
npm ci
npm run build
npm_config_prefix="$HOME/.local" npm link
hash -r
aiforge --help
openspec --version
```

Ensure `$HOME/.local/bin` is near the front of `PATH`. Using a user-owned prefix avoids requiring `sudo` and prevents root-owned npm links under `/usr/local`.

For one-off development without a global link:

```bash
npm ci
npm run build
node ./dist/src/cli/index.js --help
```

## Quick Start

In the repository you want to manage:

```bash
aiforge detect
aiforge init --profile nextjs
aiforge doctor
```

For an existing repository where you want aiforge to inspect the stack first:

```bash
aiforge detect
aiforge adopt
aiforge doctor
```

The CLI uses the current working directory by default. Pass `--repo /path/to/repo` when you want to operate on another checkout.

## Common Commands

```bash
aiforge detect
aiforge init --profile python-django
aiforge init --interactive
aiforge adopt
aiforge sync
aiforge update
aiforge doctor
aiforge mcp scaffold
aiforge manifesto init
aiforge llms build # only when features.llms is enabled
aiforge project-stub
```

Extension and remote skill lifecycle:

```bash
aiforge extension add /absolute/path/to/extension
aiforge extension list
aiforge extension update <name>
aiforge extension remove <name>

aiforge skills add-git --url https://example.com/skills.git --id team-skills
aiforge skills list
aiforge skills remove <id>
```

## How Updates Work

`ai.config.yaml` is the durable process contract. `sync` and `update` use it to render managed surfaces again.

- `sync` reconciles the current installed template against the current config.
- `update` runs the Copier update flow for template/runtime evolution.
- repo-local fields such as `manifesto.markdown`, `projectRules`, `agents.markdown`, `agents.modelTiers`, `agents.runtimeModels`, and custom commands are preserved for the same profile.
- OpenSpec workflow skills are refreshed and aiforge-managed context/rules in `openspec/config.yaml` are reconciled without removing project-specific context or rules.

When changing stack profiles intentionally:

```bash
aiforge sync --profile react-vite
```

## Model Tiers

Agent runtimes do not expose a shared API for selecting concrete models. aiforge uses semantic tiers in config and lets each runtime map them to its own model IDs.

```yaml
agents:
  modelTiers:
    orchestrator: balanced
    plan: balanced
    skeptic: balanced
    clarify: balanced
    implement: quality
    review: budget
    audit: budget
    tracker: balanced
  runtimeModels:
    cursor:
      quality: claude-opus-4-8-thinking-high
      balanced: composer-2.5-fast
      budget: gpt-5-mini
    codex:
      budget: o4-mini
```

The orchestrator runtime helpers expose the active runtime and model hint:

```bash
node .ai/runtime/orchestrator-state.mjs active-runtime
node .ai/runtime/orchestrator-state.mjs model-hint --role review
```

## Review and Orchestration

The generated workflow follows:

```text
issue -> plan -> implement -> review -> scoped test + lint -> full verify
```

The orchestrator keeps review cost under control:

- review runs immediately after implementation; no pre-review gate is run
- scoped tests and lint are required after review
- full verification is reserved for the final gate
- medium/high/critical findings trigger a bounded fix loop; repeat review only when the fix is non-trivial or explicitly required

## MCP

`aiforge mcp scaffold` writes managed MCP blocks using `aiforge-*` server names and leaves unrelated entries alone. Placeholder support currently includes:

- Linear
- GitHub
- filesystem
- Postgres
- Playwright
- Chrome DevTools
- framework docs
- project database

Run `aiforge doctor` for missing environment hints.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Useful source areas:

- `src/cli` - command registration
- `src/commands` - command handlers
- `src/core/config.ts` - config load, normalize, validate, and render answers
- `src/core/profiles` - stack profiles and detection
- `template/base` - generated workflow surfaces
- `tests` - unit and integration coverage

## Documentation

- [Architecture](docs/architecture.md)
- [Feature scope](docs/feature.md)
- [Adopting an existing repo](docs/adopt-existing-repo.md)
- [Runtime surfaces](docs/runtime-surfaces.md)
- [Profile authoring](docs/profile-authoring.md)
- [Extensions and remote skills](docs/extensions-remote-skills.md)

## License

MIT
