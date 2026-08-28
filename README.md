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
| `packages/web` | single-file demo page, deployed to [perhaps.sh](https://perhaps.sh) |

The Obsidian plugin lives in its own repo, [perhaps-obsidian](https://github.com/script-wizards/perhaps-obsidian), and bundles the engine from here as a git dependency.

## Perchance compatibility

perhaps speaks a documented subset of [Perchance](https://perchance.org) list
syntax: sections, `[refs]`, weights `^2`, inline choices `{a|b}`, ranges
`{2-12}`, `selectUnique`/`selectMany`, plus dice notation (`2d6+1`) as an
extension. Variables, functions, inline JavaScript, HTML output, and
imports are deliberately excluded; [SPEC.md](./SPEC.md) is the full contract.
Tables written for the subset run offline, deterministically under a seed, and
without an account. perhaps is an independent clean-room implementation, not
affiliated with Perchance.

```bash
just install
just test
just roll fixtures/encounters.md
```

## License

Apache-2.0
