# perhaps

Random tables in plain text. Write tables in markdown, roll them anywhere:
a CLI, an Obsidian plugin, the web. Perchance-inspired syntax, documented as
a real spec ([SPEC.md](./SPEC.md)), implemented clean-room with a seedable,
zero-dependency engine.

Successor to [Oracle](https://github.com/script-wizards/oracle).

## Packages

| package | what |
|---|---|
| `packages/engine` | `@scriptwizards/perhaps-engine`: parser + roller, no dependencies, no platform APIs |
| `packages/cli` | `perhaps <file.md> [table]`, `--list`, `--seed n` |
| `packages/obsidian` | Obsidian plugin: palette roll, insert at cursor, live code block rollers |
| `packages/web` | single-file demo page, deployed to [perhaps.sh](https://perhaps.sh) |

## Development

```bash
just install
just test
just roll fixtures/encounters.md
```

## License

Apache-2.0
