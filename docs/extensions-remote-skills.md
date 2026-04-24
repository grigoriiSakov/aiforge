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

`extension add` and `skills add-git` run `src/core/security/gate.ts` (regex-based). **Blocked** patterns abort install; **warn** patterns record `SECURITY_WARN.txt` in the installed extension copy and append a `warn` entry to `.aiforge.json` → `security.lastScans`.

## Remote skills precedence

Core template skills live under `.ai/skills/*`. Extension copies use a disambiguated prefix (`extname__skill`). Remote git skills use a single directory name from `--id`. Avoid colliding ids.

## `extension update`

Only **absolute local paths** recorded in `.aiforge.json` → `extensions[].source` are supported for re-copy today.
