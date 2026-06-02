# aiforge

MVP CLI для стандартизации AI-facing слоя в новых и существующих репозиториях: единый `ai.config.yaml`, шаблон через Copier, task-runner, семантические model tiers для skills, MCP, расширения и remote skills.

## Стек

- Node.js + TypeScript
- Copier — template / update
- Task (`go-task`) — command layer в целевом проекте

---

## Быстрый старт (разработка CLI)

Пути ниже **примеры**: подставь каталог, куда **ты** клонировал репозиторий (или задай переменную один раз).

```bash
# 1) Клон и вход в репозиторий aiforge (имя папки — любое)
git clone <URL-репозитория> aiforge
cd aiforge

# Удобно зафиксировать корень в переменной (опционально)
export AIFORGE_SRC="$(pwd)"

# 2) Сборка и глобальная команда `aiforge` через npm link
npm ci
npm run build
npm link

# 3) Проверка
aiforge --help
```

Дальше в **любом** проекте (другой каталог):

```bash
cd /path/to/your-app
aiforge detect
aiforge init --profile laravel-docker
# или интерактив: aiforge init --interactive
aiforge doctor
```

По умолчанию `--repo` не нужен: CLI использует **текущую директорию** (`process.cwd()`).

---

## Установка CLI (варианты)

Во всех блоках вместо `cd …` можно писать `cd "$AIFORGE_SRC"`, если переменная задана как в примере выше.

### Вариант 1 — `npm link` (удобно для разработки)

```bash
cd /path/to/aiforge-repo
npm ci
npm run build
npm link
aiforge --help
```

### Вариант 2 — глобальная установка без symlink

```bash
cd /path/to/aiforge-repo
npm ci
npm run build
npm install -g .
```

### Вариант 3 — разовый запуск без `npm link`

Из корня репозитория aiforge:

```bash
cd /path/to/aiforge-repo
npm ci
npm run build
node ./dist/src/cli/index.js --help
```

Явный репозиторий для команд:

```bash
node /path/to/aiforge-repo/dist/src/cli/index.js doctor --repo /path/to/your-app
```

---

## Что генерируется

| Поверхность | Назначение |
|-------------|------------|
| `ai.config.yaml` | Контракт процесса: профиль, runtimes, entrypoints, `agents.modelTiers`, `manifesto` / `projectRules` |
| `.ai/**` | Skills, rules, reference, runtime |
| `AGENTS.md`, `MANIFESTO.md` | Собираются из YAML (не править как SoT вручную) |
| `.cursor/**`, `.codex/**`, `.claude/**`, `.agent/**`, `.agents/**` | Runtime-обвязка и symlinks на `.ai` |
| `Taskfile.yml`, `llms.txt`, `llms/**` | Task layer и LLM context |
| `.ai/project.manifest.json` | Зеркало YAML для хуков без парсера |
| `.ai/project.model-profiles.json` | Зеркало `agents.modelTiers` + optional `runtimeModels` (после `sync` / `saveConfig`) |
| `.aiforge.json` | Installer state: MCP, extensions, remote skills, security log, runtimes для `doctor` |
| MCP JSON | `.cursor/mcp.json`, `.mcp.json`, `.codex/mcp.json` — серверы с префиксом `aiforge-*` |

---

## Dual-state: процесс vs installer

- **`ai.config.yaml`** — durable process contract.
- **`.ai/project.manifest.json`** — зеркало для инструментов без YAML.
- **`.ai/project.model-profiles.json`** — machine-readable роли → tier → semantics; пишется вместе с manifest.
- **`.aiforge.json`** — то, чем владеет CLI (MCP managed blocks, extensions, remote skills, последний security scan, согласованность runtimes с YAML).

После `saveConfig` / `writeMachineManifest` обновляются manifest, model-profiles и installer state; `aiforge doctor` требует `.aiforge.json` и проверяет runtimes.

---

## `sync`, `update` и `ai.config.yaml`

Типичный сценарий обновления шаблона **без** смены профиля:

```bash
cd /path/to/your-app
aiforge sync
# или
aiforge update
```

В этом режиме **`ai.config.yaml` не перезаписывается** — обновляются managed surfaces (Copier + post-steps), плюс манифест / model-profiles / `.aiforge.json`. Твои секции вроде `manifesto.markdown`, `linear.scopes`, `agents.modelTiers`, `agents.runtimeModels`, `agents.markdown`, `projectRules`, кастомные `commands` для **того же** `profile.id` сохраняются. Старые репо без `agents.modelTiers` получают дефолты при load/sync (YAML на диске не трогается, пока сам не сохранишь конфиг).

Явная смена профиля (редкий случай):

```bash
aiforge sync --profile vue-quasar-capacitor
```

Тогда YAML пересохраняется: **`profile.id` и шаблон команд** берутся из нового профиля, а repo-local куски (`linear`, `workflow`, `manifesto` body, `agents`, `projectRules`, непустые `llms.sourceGlobs`) **не затираются** логикой merge в CLI.

---

## Команды (шпаргалка)

Разработка из исходников aiforge (замени пути):

```bash
cd /path/to/aiforge-repo
npm run build
npx tsx src/cli/index.ts detect --repo /path/to/your-app
npx tsx src/cli/index.ts init --repo /path/to/your-app --interactive
npx tsx src/cli/index.ts adopt --repo /path/to/existing-app
npx tsx src/cli/index.ts sync --repo /path/to/your-app
npx tsx src/cli/index.ts update --repo /path/to/your-app
npx tsx src/cli/index.ts doctor --repo /path/to/your-app
```

После `npm link` из каталога приложения:

```bash
aiforge detect
aiforge init --profile python-fastapi-docker
aiforge sync
aiforge doctor
```

Расширения и skills:

```bash
aiforge extension add /path/to/extension --repo /path/to/your-app
aiforge extension list
aiforge extension remove <name>
aiforge extension update <name>

aiforge skills add-git --url https://example.com/skills.git --id my-remote-skills
aiforge skills list
aiforge skills remove <id>
```

Прочее:

```bash
aiforge mcp scaffold
aiforge manifesto init
aiforge llms build
aiforge project-stub
```

Supervisor (low-level control plane), из корня целевого репо:

```bash
aiforge supervisor import --slug my-initiative --manifest .ai/context/initiatives/my-initiative/issues-manifest.json
aiforge supervisor init --slug my-initiative
aiforge supervisor daemon --slug my-initiative
aiforge supervisor status --slug my-initiative
aiforge supervisor pause --slug my-initiative --reason "manual hold"
aiforge supervisor resume --slug my-initiative
aiforge supervisor abort --slug my-initiative --reason "stop loop"
```

Полный список: `aiforge supervisor --help`.

### `--interactive` (`init` / `adopt`)

Stdin: выбор профиля (если детект слабый), имя проекта, опционально — **короткие однострочные заготовки** для `manifesto.markdown`, `agents.markdown`, `projectRules.markdown` (после вопроса «Add one-line starter text… [y/N]»).

---

## MCP

Плейсхолдеры `ai.config.yaml` → `mcp.placeholders` мапятся на registry (`src/core/mcp-registry.ts`): `linear`, `github`, `filesystem`, `postgres`, `playwright`, `chrome-devtools`, `framework-docs`, `project-db`.

`aiforge mcp scaffold` мержит серверы под ключами `aiforge-*`, не удаляя чужие записи. Подсказки по env — в `aiforge doctor` (`mcpEnvHints`).

---

## Extensions и remote skills

- **`extension add <path>`** — локальная директория с `extension.json`; security gate перед установкой.
- **`extension update` / `remove` / `list`** — lifecycle.
- **`skills add-git --url … --id …`** — shallow clone, gate, копия в `.ai/skills/<id>`, запись в `.aiforge.json`.

Подробнее: [docs/extensions-remote-skills.md](docs/extensions-remote-skills.md).

---

## Generic process kernel

Общий слой (не привязан к конкретному стеку): `.ai/rules`, `.ai/skills`, `.ai/reference`, `.ai/context`, линки из `.cursor` / `.codex` / `.claude` / `.agent` / `.agents` на эти деревья. Профильные ограничения — отдельными rules и `ai.config.yaml`.

Канонический issue-flow: `issue → plan → implement → test → review` (skills `/plan`, `/implement`, `/orchestrator` и т.д.). Plan/progress — только локально под `artifacts.planProgressRoot` (по умолчанию `.ai/context/runtime/ISSUE-ID/`).

---

## Model tiers (бюджет между Cursor / Codex / Claude)

IDE не дают единого API «поставь модель X». В aiforge бюджет — **семантические tier'ы** в YAML + опциональные slug'и per-runtime; skills и reference переводят tier в действие.

| Tier | Назначение |
|------|------------|
| `quality` | Архитектура, рискованные рефакторы, implement |
| `balanced` | Plan, orchestrator main session, tracker, clarify |
| `budget` | Параллельные review + audit subagent'ы |

Дефолты при `init` (можно переопределить):

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
```

Опционально — конкретные model ID там, где runtime умеет явный выбор (например Cursor Task `model`):

```yaml
agents:
  runtimeModels:
    cursor:
      quality: claude-opus-4-8-thinking-high
      balanced: composer-2.5-fast
      budget: gpt-5-mini
    codex:
      budget: o4-mini
```

CLI **не переключает** модели в IDE — только нормализует конфиг и пишет `.ai/project.model-profiles.json`. В рантайме читай:

- `.ai/reference/model-profiles.md` — таблица ролей и правила multi-runtime;
- skills (`orchestrator`, `plan`, `review`, …) — tier из `ai.config.yaml`.

Для Codex/Claude без mapping в `runtimeModels` агент остаётся на tier в промпте и на дефолтах UI/CLI пользователя.

---

## Усиления пайплайна (reference + skills)

| Артефакт / skill | Что добавляет |
|------------------|---------------|
| `plan-template` → `## Implementation Decisions` | discuss-before-plan без отдельного трекера |
| `/clarify` | Вопросы до плана; ответы → bullets для planner |
| `verify-fix-loop.md` | Секция `## Fix Loop` в `progress.md` после verify/review/audit |
| orchestrator gate | review + audit на `budget` + `model-hint`; scoped tests между фазами; full verify один раз; лимит fix-loop (default 2) → спросить пользователя |

---

## Project-specific: YAML и `project-stub`

Источник истины для генерируемых `MANIFESTO.md` / `AGENTS.md` / `.ai/rules/project-profile.mdc` — поля в **`ai.config.yaml`**. После `sync` / `update` эти файлы пересобираются.

Готовый текст для вставки в чат модели (чтобы она помогла заполнить YAML):

```bash
aiforge project-stub
```

Примеры фрагментов YAML:

**`projectRules.markdown`:**

```yaml
projectRules:
  markdown: |
    ## Architecture Constraints
    - API schema changes require explicit migration notes.
    - Do not introduce cross-module imports from `app/*` into `domain/*`.
```

**`manifesto`:**

```yaml
manifesto:
  title: Project Workflow Manifesto
  path: MANIFESTO.md
  markdown: |
    ## Non-Negotiables
    - All externally visible behavior changes require spec notes.
```

**`agents` (prose + model tiers):**

```yaml
agents:
  markdown: |
    ## Repo-Specific Constraints
    - Always treat `apps/api` as the system-of-record boundary.
  modelTiers:
    implement: quality
    review: budget
    audit: budget
  runtimeModels:
    cursor:
      budget: gpt-5-mini
```

`agents.markdown` попадает в `AGENTS.md` при `sync`. `modelTiers` / `runtimeModels` — только контракт для skills (не подмешиваются в AGENTS автоматически).

---

## Linear helpers

Инициализация scope-файлов из текущего YAML:

```bash
aiforge linear init
```

Явная привязка team/project/labels:

```bash
aiforge linear scope set \
  --team "Vertex Backend" \
  --team-id "00000000-0000-0000-0000-000000000000" \
  --project "Kernel" \
  --project-id "00000000-0000-0000-0000-000000000001" \
  --label backend automation
```

Обновляет `ai.config.yaml`, `.ai/project.manifest.json`, `.ai/linear-scope.json`, `.cursor/settings.json`.

---

## Supervisor

Основной UX — через skill `/supervisor` в чате; CLI остаётся control plane для импорта, daemon, pause/resume. Durable state: `.ai/runtime/supervisor/**`.

---

## Поддерживаемые профили MVP

- `python-fastapi-docker`
- `laravel-docker`
- `vue-quasar-capacitor`

---

## Принципы

- Generic hooks, без захардкоженного `uv` / `artisan` / `yarn` в ядре.
- Stack-specific команды — в profile / `ai.config.yaml`.
- Update — через Copier, не самописный OS-слой.
- Канонический workflow — через repo-local `.ai/bin/go-task` и имена задач из конфига.

---

## Linear-first surfaces

Генерация и scaffold: `.ai/linear-scope.json`, `.cursor/settings.json`, `.cursor/rules/linear-mcp.mdc` — контракт team/project, degraded mode, tracker-first flow.

---

## Документация

- [feature.md](feature.md)
- [architecture.md](architecture.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/profile-authoring.md](docs/profile-authoring.md)
- [docs/adopt-existing-repo.md](docs/adopt-existing-repo.md)
- [docs/extensions-remote-skills.md](docs/extensions-remote-skills.md)
