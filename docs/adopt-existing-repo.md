# Adopting an Existing Repository

Use `adopt` when a repository already has application code and you want to add the aiforge workflow layer without rewriting the project.

## Flow

```bash
aiforge detect
aiforge adopt
aiforge doctor
```

With an explicit target:

```bash
aiforge detect --repo /path/to/repo
aiforge adopt --repo /path/to/repo
aiforge doctor --repo /path/to/repo
```

## What Adoption Does

- Detects stack signals and recommends a profile.
- Creates `ai.config.yaml`.
- Renders managed workflow surfaces.
- Writes machine manifests for runtime hooks and model tiers.
- Installs the repo-local Task wrapper.
- Leaves business code alone.

## Safety Contract

Adoption is scoped to AI/runtime/config surfaces. Application files are not modified.

If a repository already has local agent instructions, review the generated `ai.config.yaml`, `AGENTS.md`, and `.ai/rules/project-profile.mdc` after adoption and move durable project rules into `projectRules.markdown`.

## Sync vs Update

- `sync` renders the current desired state from `ai.config.yaml`.
- `update` applies template/runtime evolution through Copier.

Use `sync` after editing config. Use `update` when a newer aiforge template should be applied to an already managed repository.
