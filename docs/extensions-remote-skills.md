# Extensions and remote skills

## Extension layout (source directory)

```
my-extension/
├── extension.json     # required: name, version; optional: skills[]
└── skills/
    └── hello/
        └── SKILL.md
```

`extension.json`:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "skills": ["skills/hello"]
}
```

Install copies the tree to `.aiforge/extensions/<name>/` and duplicates declared skills into `.ai/skills/<name>__<basename>/` so they participate in the shared kernel symlinked into IDE surfaces.

## Security gate

`extension add` and `skills add-git` run `src/core/security/gate.ts` (lightweight static scan). **Blocked** patterns abort install; **warn** patterns record `SECURITY_WARN.txt` in the installed extension copy and append a `warn` entry to `.aiforge.json` → `security.lastScans`.

The gate rejects unsafe path traversal, packages without `SKILL.md`, symlinks, sensitive key/env files, and oversized files. Script or executable files are allowed but recorded as warnings. VCS/package metadata such as `.git` and `node_modules` is ignored by the scan and excluded from installed copies.

Extensions and remote skills should still be treated as trusted-source artifacts. Review third-party skill content before installing it.

## Remote skills precedence

Core template skills live under `.ai/skills/*`. Extension copies use a disambiguated prefix (`extname__skill`). Remote git skills use a single directory name from `--id`. Avoid colliding ids.

## `extension update`

Only **absolute local paths** recorded in `.aiforge.json` → `extensions[].source` are supported for re-copy today.
