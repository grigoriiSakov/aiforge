# aiforge

MVP CLI-конфигуратор для стандартизации AI-facing engineering surfaces в новых и существующих репозиториях.

## Stack

- Node.js + TypeScript
- Copier как template/update engine
- Task как единый command layer

## Что генерируется

- `AGENTS.md`
- `MANIFESTO.md`
- `.ai/**`
- `.cursor/**`
- `.cursor/settings.json`
- `.codex/**`
- `.agent/**`
- `.agents/**`
- `Taskfile.yml`
- `llms.txt`
- `llms/**`

## Команды

```bash
npm run build
npx tsx src/cli/index.ts detect --repo /path/to/repo
npx tsx src/cli/index.ts init --repo /path/to/repo
npx tsx src/cli/index.ts adopt --repo /path/to/existing-repo
npx tsx src/cli/index.ts sync --repo /path/to/repo
npx tsx src/cli/index.ts update --repo /path/to/repo
npx tsx src/cli/index.ts doctor --repo /path/to/repo
npx tsx src/cli/index.ts mcp scaffold --repo /path/to/repo
npx tsx src/cli/index.ts manifesto init --repo /path/to/repo
npx tsx src/cli/index.ts llms build --repo /path/to/repo
```

## Generic process kernel

`aiforge` теперь тащит не только runtime surfaces, но и reusable process kernel:

- `.ai/rules/*`
- `.ai/skills/*`
- `.ai/reference/*`
- `.ai/context/*`
- `.ai/linear-scope.json`
- `.cursor/HIERARCHY.md`
- `.cursor/skills -> .ai/skills`
- `.cursor/rules -> .ai/rules`
- `.cursor/reference -> .ai/reference`
- `.cursor/context -> .ai/context`
- `.agent/skills -> .ai/skills`
- `.agent/rules -> .ai/rules`
- `.codex/skills -> .ai/skills`
- `.codex/rules -> .ai/rules`
- `.agents/skills -> .ai/skills`

Это generic слой. Он не должен знать твой конкретный стек глубоко.
Например, `workflow-gates.mdc` тащит общие plan/build/test/review/docs gate'ы, а profile-specific ограничения докручиваются отдельными rules поверх него.

## Project-specific customization stub

Когда generic kernel уже развернут, но ещё нужны project-dependent rules/commands, можно вывести готовый prompt-stub:

```bash
aiforge project-stub
```

Он печатает в консоль markdown-заглушку, которую можно копипастнуть модели, чтобы она:

- проанализировала конкретный репозиторий;
- подготовила durable project-specific rules в `ai.config.yaml` -> `projectRules.markdown`;
- подготовила durable manifesto content в `ai.config.yaml` -> `manifesto.markdown`;
- подготовила durable `AGENTS.md` content в `ai.config.yaml` -> `agents.markdown`;
- обновила `Taskfile.yml` и связанные generated surfaces;
- настроила tracker/MCP-specific surfaces без переписывания generic kernel.

Важно:

- не редактируй руками `.ai/rules/project-profile.mdc` как источник истины;
- не редактируй руками `MANIFESTO.md` как источник истины;
- не редактируй руками `AGENTS.md` как источник истины;
- эти файлы генерируются из `ai.config.yaml` и будут пересобраны при `aiforge sync` / `aiforge update`.

Пример durable project-specific rules:

```yaml
projectRules:
  markdown: |
    ## Architecture Constraints
    - API schema changes require explicit migration notes.
    - Do not introduce cross-module imports from `app/*` into `domain/*`.
```

Пример durable manifesto:

```yaml
manifesto:
  title: Project Workflow Manifesto
  path: MANIFESTO.md
  markdown: |
    # Project Workflow Manifesto

    ## Non-Negotiables

    - All externally visible behavior changes require spec notes.
    - Every non-trivial task must leave behind durable verification evidence.
```

Пример durable AGENTS:

```yaml
agents:
  markdown: |
    # AGENTS.md

    ## Repo-Specific Constraints

    - Always treat `apps/api` as the system-of-record boundary.
    - Never modify deployment manifests without updating rollout notes.
```

## Linear helpers

Чтобы не править shared tracker scope руками:

```bash
aiforge linear init
```

Это переинициализирует:

- `.ai/linear-scope.json`
- `.cursor/settings.json`

из текущего `ai.config.yaml`.

Чтобы выставить team/project/labels явно:

```bash
aiforge linear scope set \
  --team "Vertex Backend" \
  --team-id "team-uuid" \
  --project "Kernel" \
  --project-id "project-uuid" \
  --label backend automation
```

Эта команда обновляет:

- `ai.config.yaml`
- `.agents/project.manifest.json`
- `.ai/linear-scope.json`
- `.cursor/settings.json`

## Установка CLI как глобальной команды

После этого ты сможешь в любом проекте писать просто `aiforge update`, `aiforge doctor` и т.д.

### Вариант 1. Локальный development symlink

```bash
cd /home/grigorii/Projects/ai-simple-template
npm run build
npm link
```

Проверка:

```bash
aiforge --help
```

Использование из целевого проекта:

```bash
cd /path/to/project
aiforge detect
aiforge init --profile python-fastapi-docker
aiforge update
aiforge doctor
```

### Вариант 2. Глобальная установка без symlink

```bash
cd /home/grigorii/Projects/ai-simple-template
npm run build
npm install -g .
```

### Вариант 3. Разовая команда без установки в PATH

```bash
cd /home/grigorii/Projects/ai-simple-template
npm run build
node /home/grigorii/Projects/ai-simple-template/dist/src/cli/index.js --help
```

## Поведение по умолчанию

CLI по умолчанию работает в текущей директории, потому что `--repo` по умолчанию = `process.cwd()`.

То есть после `npm link` из проекта можно писать просто:

```bash
aiforge update
aiforge sync
aiforge doctor
```

## Поддерживаемые профили MVP

- `python-fastapi-docker`
- `laravel-docker`
- `vue-quasar-capacitor`

## Принципы

- generic hooks, без hardcoded `uv` / `artisan` / `yarn` в ядре;
- stack-specific команды живут в profile/config;
- update flow идёт через `Copier`, а не через собственную heavyweight OS;
- canonical workflow опирается на `task build/test/lint/verify/review`.

## Linear-first surfaces

Если проект живёт вокруг Linear workflow, `aiforge` теперь генерирует и scaffold'ит:

- `.ai/linear-scope.json`
- `.cursor/settings.json`
- `.cursor/rules/linear-mcp.mdc`

Это не заменяет локальную MCP-настройку полностью, но подсказывает:

- какой team/project scope должен использоваться;
- что плагин Linear должен быть включён;
- как должен работать degraded mode;
- где должен лежать tracker-first process contract.

## Документация

- [`feature.md`](feature.md)
- [`architecture.md`](architecture.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/profile-authoring.md`](docs/profile-authoring.md)
- [`docs/adopt-existing-repo.md`](docs/adopt-existing-repo.md)
