# CLI Configurator MVP — Feature Spec

## 1) Product Goal

Сделать Node.js + TypeScript CLI, который быстро стандартизирует инженерную среду проекта через управляемые шаблоны и безопасные обновления.

MVP-фокус:
- bootstrap managed surfaces в существующем или новом проекте;
- единый UX команд через `task`;
- предсказуемый update lifecycle без ручного копипаста.

## 2) Problem Statement

Команды тратят время на ручную настройку `.cursor/.codex/.agent/.agents`, `AGENTS.md`, `MANIFESTO.md`, `llms`-артефактов и workflow-команд. Конфигурация дрейфует между проектами, обновления неаудируемые.

## 3) MVP Scope

CLI предоставляет команды:
- `init` — инициализация нового managed foundation в репозитории.
- `adopt` — принятие существующего проекта под управление (без полного перегенерата всего подряд).
- `detect` — определение project profile и текущего состояния поверхностей.
- `sync` — выравнивание managed surfaces с текущим профилем/манифестом.
- `update` — обновление template/runtime артефактов через локальный render/apply flow без git-зависимости.
- `doctor` — диагностика drift/конфликтов/битых зависимостей.
- `mcp scaffold` — каркас MCP-конфигурации/подключений.
- `manifesto init` — первичная инициализация `MANIFESTO.md`.
- `llms build` — сборка `llms.txt` и `llms/**`.

Поддерживаемые профили MVP:
- `python-fastapi-docker`
- `laravel-docker`
- `vue-quasar-capacitor`

Template/update engine:
- Copier copy/render как локальный apply engine без зависимости от git-based template update.

Unified command layer:
- Task (единая точка запуска команд для пользователя и CI).

## 4) Success Criteria (MVP)

- За <= 5 минут проект получает валидный baseline managed surfaces.
- `detect -> sync -> doctor` проходит без критических ошибок в типовом репозитории.
- `update` выполняется идемпотентно при отсутствии локальных правок в managed файлах.
- Каждый профиль разворачивается одинаковыми командами без profile-specific ручных шагов.

## 5) Non-Goals (MVP)

- Полный package/dependency manager (npm/pnpm/pip/composer orchestration вне минимально нужного).
- Глубокий semantic merge пользовательских правок в managed файлах (только базовый conflict/report flow).
- Автогенерация бизнес-кода приложения.
- Плагинная marketplace-экосистема.
- Автоматическая миграция legacy custom scripts за пределами declared surfaces.

## 6) User-facing Command Contract (MVP)

Базовый интерфейс:
- `cli <command> [--profile <id>] [--yes] [--dry-run] [--json]`

Обязательные UX-инварианты:
- Все mutating команды поддерживают `--dry-run`.
- Любая команда может печатать machine-readable output (`--json`) для CI.
- Ошибки имеют стабильные error codes и actionable remediation hints.

## 7) Risks

- Drift между template версией и локальными правками managed файлов.
- Некорректное определение профиля при `detect` в смешанных репозиториях.
- Частичное применение изменений при сбоях update/sync.

MVP mitigation:
- preflight checks (`doctor` + internal validation),
- transactional apply-per-surface (с явным отчетом, где не применилось),
- backup/restore для mutating этапов.
