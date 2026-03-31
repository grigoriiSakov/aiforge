# aiforge

MVP CLI-конфигуратор для стандартизации AI-facing engineering surfaces в новых и существующих репозиториях.

## Stack

- Node.js + TypeScript
- Copier как template/update engine
- Task как единый command layer

## Что генерируется

- `AGENTS.md`
- `MANIFESTO.md`
- `.cursor/**`
- `.cursor/linear-scope.json`
- `.cursor/settings.json`
- `.cursor/PROMPT_OPTIMIZATION_STRATEGY.md`
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

- `.cursor/HIERARCHY.md`
- `.cursor/rules/workflow-gates.mdc`
- `.cursor/reference/context-budget.md`
- `.cursor/reference/issue-spec-template.md`
- `.cursor/reference/tracker-degraded-mode.md`
- `.cursor/commands/issue.md`
- `.cursor/commands/clarify.md`
- `.cursor/commands/check.md`
- `.cursor/commands/debug.md`
- `.cursor/commands/docs.md`
- `.cursor/commands/investigate.md`
- `.cursor/commands/refactor.md`
- `.cursor/commands/repeat.md`
- `.cursor/skills/*`
- `.codex/skills/aiforge-*`

Это generic слой. Он не должен знать твой конкретный стек глубоко.
Например, `workflow-gates.mdc` тащит общие plan/build/test/review/docs gate'ы, а profile-specific ограничения докручиваются отдельными rules поверх него.

## Project-specific customization stub

Когда generic kernel уже развернут, но ещё нужны project-dependent rules/commands, можно вывести готовый prompt-stub:

```bash
aiforge project-stub
```

Он печатает в консоль markdown-заглушку, которую можно копипастнуть модели, чтобы она:

- проанализировала конкретный репозиторий;
- дописала project-specific правила;
- обновила `Taskfile.yml`, `MANIFESTO.md`, `.cursor/rules/project-profile.mdc`;
- настроила tracker/MCP-specific surfaces без переписывания generic kernel.

## Linear helpers

Чтобы не править `.cursor/linear-scope.json` руками:

```bash
aiforge linear init
```

Это переинициализирует:

- `.cursor/linear-scope.json`
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
- `.cursor/linear-scope.json`
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

- `.cursor/linear-scope.json`
- `.cursor/settings.json`
- `.cursor/PROMPT_OPTIMIZATION_STRATEGY.md`
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
