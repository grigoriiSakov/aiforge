# CLI Configurator MVP — Architecture Spec

## 1) Runtime & Stack

- Language: TypeScript (Node.js LTS).
- Distribution: npm package + `npx` entry.
- Template engine: Copier.
- Command runner surface: Task.
- Target: Linux/macOS first (Windows support as follow-up).

## 2) Configuration Model

Конфигурация строится вокруг единого project manifest (logical model, может храниться в `.ai/project.manifest.json`):

- `schemaVersion`: версия схемы манифеста.
- `projectProfile`: `python-fastapi-docker | laravel-docker | vue-quasar-capacitor`.
- `managedSurfaces`: список путей и политик управления (`managed`, `semi-managed`, `unmanaged`).
- `tooling`: флаги и опции для local render/Task/MCP/LLMS.
- `updatePolicy`: режим update (strict, preserve-local-overrides, report-only).
- `features`: включенные capability-флаги (`mcp`, `llms`, `manifesto`, ...).

Precedence:
1) CLI flags
2) local manifest
3) profile defaults
4) template defaults

## 3) Directory Layout (target after init/adopt)

Managed surfaces:
- `.cursor/`
- `.codex/`
- `.claude/`
- `.agent/`
- `.agents/`
- `AGENTS.md`
- `MANIFESTO.md`
- `llms.txt`
- `llms/**`

Suggested service internals for CLI repo:
- `src/commands/*` — command handlers (`init`, `adopt`, ...).
- `src/core/config/*` — load/validate/merge config.
- `src/core/copier/*` — local render adapter.
- `src/core/surfaces/*` — apply/backup/diff/ownership logic.
- `src/core/profiles/*` — profile definitions and detection rules.
- `src/core/doctor/*` — diagnostics and health checks.
- `src/core/task/*` — Task integration.
- `src/core/llms/*` — llms build pipeline.
- `src/core/mcp/*` — scaffold and validation.

## 4) Managed vs Unmanaged Surfaces

Managed:
- Полностью контролируются CLI/template; редактирование допускается, но может быть перезаписано `sync/update`.

Semi-managed:
- Пользовательские блоки/override sections допускаются по explicit marker policy.

Unmanaged:
- Любые бизнес-файлы проекта вне declared surfaces; CLI читает только для detect/doctor.

Ownership contract:
- Каждому managed файлу присваивается ownership metadata (в manifest/state), чтобы `doctor` фиксировал drift и unsupported manual changes.

## 5) Key Command Flows (data flow)

Общий pipeline для mutating команд:
1) `load config` (flags + manifest + profile defaults)
2) `detect environment` (repo facts, profile hints)
3) `plan changes` (diff intended vs actual)
4) `preflight checks` (permissions, required binaries, conflicts)
5) `apply` (local render + surface writer)
6) `post-verify` (`doctor` checks subset)
7) `report` (human + optional JSON)

Команды:
- `init`: bootstrap manifest + initial managed render.
- `adopt`: detect existing files, map ownership, then selective sync.
- `detect`: read-only profile/state inference.
- `sync`: reconcile to desired state by manifest.
- `update`: локальный reconcile/apply lifecycle без git template refs.
- `doctor`: consistency + dependency + drift checks.
- `mcp scaffold`: create/update MCP baseline artifacts.
- `manifesto init`: create initial manifesto surface.
- `llms build`: regenerate `llms.txt` and `llms/**`.

## 6) Update Lifecycle

Stages:
1) Snapshot current managed surfaces.
2) Render current template locally against current config.
3) Compute/apply managed surface changes.
4) Restore shared symlinks and runtime artifacts.
5) Run doctor subset.
6) Summary output (changed/skipped/conflicted).

Failure policy (MVP):
- Hard-fail on schema mismatch or critical conflicts.
- Partial apply is allowed only with explicit per-surface status and non-zero exit code.
- Rollback from snapshot for catastrophic apply failures.

## 7) Test Strategy (MVP)

Test pyramid:
- Unit tests:
  - config merge/precedence,
  - profile detection rules,
  - managed ownership and diff planner,
  - error code mapping.
- Integration tests:
  - command e2e in temp repos,
  - local Copier render/apply flow on fixture templates,
  - `detect -> sync -> doctor` lifecycle per profile.
- Golden/snapshot tests:
  - generated surfaces (`AGENTS.md`, `MANIFESTO.md`, `llms` tree).
- Contract tests:
  - `--json` output schema stability for CI consumers.

CI minimum gates:
- lint + typecheck
- unit + integration
- smoke run of all key commands in dry-run mode

## 8) Observability & Exit Codes

- Structured logs with command stage and duration.
- Stable exit codes:
  - `0` success,
  - `2` validation/preflight failure,
  - `3` conflict/drift requires manual action,
  - `4` runtime dependency/internal failure.
