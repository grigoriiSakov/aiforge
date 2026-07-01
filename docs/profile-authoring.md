# Profile Authoring

A profile gives a stack useful defaults without hardcoding stack behavior into the generic workflow layer.

Profiles currently live in:

- `src/core/types.ts`
- `src/core/profiles/definitions.ts`
- `src/core/profiles/detect.ts`
- `profiles/<profile-id>/README.md`
- `tests/fixtures/<profile-id>/`

Each profile defines:

- detection hints
- default tracker
- default workflow language
- canonical task command arrays
- manifesto title
- LLM source globs
- short notes for humans

## Rules

- Keep generic hooks stack-neutral.
- Put stack-specific commands in the profile definition.
- Make detection additive. A single file should rarely decide the profile by itself.
- Prefer npm script conventions or standard toolchain commands where possible.
- Document assumptions in `profiles/<profile-id>/README.md`.
- Add fixtures and tests for every profile.

## Adding a Profile

1. Add the new `ProjectProfileId` in `src/core/types.ts`.
2. Add the profile definition in `src/core/profiles/definitions.ts`.
3. Extend detection scoring in `src/core/profiles/detect.ts`.
4. Add a fixture repository under `tests/fixtures/<profile-id>/`.
5. Add detection coverage in `tests/profiles.test.ts`.
6. Add a profile README under `profiles/<profile-id>/README.md`.
7. Run `npm run typecheck` and `npm test`.
