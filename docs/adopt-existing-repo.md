# Adopt Existing Repo

## Flow

1. Point CLI at an existing repository.
2. Run `detect` to inspect stack signals.
3. Run `adopt` to create config + render managed surfaces.
4. Run `doctor` to verify required surfaces are present (including `.aiforge.json` and runtime drift checks).

## Example

```bash
npx tsx src/cli/index.ts detect --repo /path/to/repo
npx tsx src/cli/index.ts adopt --repo /path/to/repo
npx tsx src/cli/index.ts doctor --repo /path/to/repo
```

## Safety contract

- MVP keeps adoption non-destructive by default.
- Managed surfaces are limited to AI/runtime/config files.
- Business code is not rewritten by the configurator.

## When to use `sync` vs `update`

- `sync`: re-render current desired state from `ai.config.yaml`
- `update`: run `copier update` after template evolution
