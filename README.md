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
| `.ai/**` | Shared rules, skills, references, context files, and runtime state helpers |
| `AGENTS.md`, `MANIFESTO.md` | Human-readable project instructions generated from `ai.config.yaml` |
| `.cursor/**`, `.codex/**`, `.claude/**`, `.agent/**`, `.agents/**` | Runtime-specific adapters and hooks |
| `Taskfile.yml` | Canonical task entrypoints used by humans and agents |
| `llms.txt`, `llms/**` | Optional LLM context output |
| `.aiforge.json` | Installer state for MCP, extensions, remote skills, and runtime checks |

Business code is not generated or rewritten.

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

- Node.js 20 or newer
- npm
- Python 3 with Copier available as either `copier` or `python3 -m copier`

Useful depending on the target repository:

- Docker / Docker Compose for Docker-based profiles
- Go, Python, PHP/Composer, npm/yarn/pnpm, or the stack toolchain used by the selected profile
- Task (`go-task`) is optional. aiforge writes a repo-local wrapper at `.ai/bin/go-task` and can install a local Task binary into `.ai/bin/task` when needed.

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
git clone https://gitlab.com/aiforge2/aiforge.git
cd aiforge
npm ci
npm run build
npm link
aiforge --help
```

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
aiforge llms build
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
issue -> plan -> implement -> test -> review
```

The orchestrator keeps review cost under control:

- scoped tests are expected before review
- full verification is reserved for the final gate
- review depth is selected from the change itself: `simple` for small local diffs, `full` for risky or broad work
- after a fix, the orchestrator chooses `skip-rereview` or `require-rereview` instead of spending review iterations by habit

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
