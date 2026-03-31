# Profile Authoring

## Goal

A profile defines stack-specific defaults without polluting the generic workflow layer.

## Current source of truth

Profiles currently live in:

- `src/core/profiles/definitions.ts`

Each profile defines:

- default tracker
- language
- canonical task command arrays
- manifesto title
- llms source globs
- human notes

## Rules

- Generic hooks must not hardcode profile commands.
- Profile commands must be executable through `Taskfile.yml`.
- Detection hints should be additive, not mutually exclusive magic.
- If a profile needs custom files, prefer template variables/conditionals over duplicating the whole workflow pack.

## Adding a profile

1. Add new `ProjectProfileId` in `src/core/types.ts`.
2. Add a profile definition in `src/core/profiles/definitions.ts`.
3. Extend detection rules in `src/core/profiles/detect.ts`.
4. Add fixture repo under `tests/fixtures/<profile-id>/`.
5. Add profile detection and command-flow tests.
6. If needed, extend template content with Jinja conditionals.
