# perhaps (Obsidian plugin)

Rolls perhaps/perchance tables anywhere in your vault. Three surfaces:

- **Roll a table**: fuzzy picker over every table in the vault, result in a
  modal. Click any underlined part to reroll just that part.
- **Roll a table into the note**: same picker, inserts the result at the
  cursor. Meant for session logs.
- Reading view: ```` ```perhaps ```` and ```` ```perchance ```` code blocks
  render as live rollers with reroll and copy.

The vault is indexed on load and kept current as files change, so tables can
reference each other across notes by title.

Syntax lives in [SPEC.md](../../SPEC.md). The engine is
`@scriptwizards/perhaps-engine`, no platform dependencies.

## Install into a vault

```bash
just plugin-install path/to/vault
```

Then enable Perhaps under Settings, Community plugins. Still to build: a
sidebar roller view with history.
