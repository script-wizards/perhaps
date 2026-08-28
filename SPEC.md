# perhaps table format v0

A documented subset of Perchance list syntax, plus one extension (dice notation).
Tables live in fenced code blocks in markdown files, language `perhaps` or
`perchance`. Every construct here is hand-writable in a 64-column text file.

## Structure

```perhaps
title
  Forest Encounters

output
  You encounter [encounter]

encounter
  a pack of wolves
  a wandering merchant ^2
  bandits demanding {2-8} gold
```

- A non-indented line names a section. Indented lines (tab or 2+ spaces) are
  entries of the section above.
- `title` is a keyword: its single indented line names the table. Without it,
  the first section name is the title.
- Rolling a table uses its `output` section if present, otherwise the first
  section.
- `//` starts a comment when at line start or preceded by whitespace, to end
  of line. `https://` is not a comment.

## Constructs

| construct | meaning |
|---|---|
| `[name]` | roll one entry from section `name` (this table first, then any table titled `name`) |
| `[name.selectUnique(n)]` | n distinct entries, joined with ", " |
| `[name.selectMany(n)]` | n entries with repeats allowed, joined with ", " |
| `entry ^2` | weight; any positive number, decimals allowed (`^0.5`) |
| `{a\|b\|c}` | inline choice, weights allowed per branch (`{a^2\|b}`), nesting allowed |
| `{2-8}` | uniform integer, inclusive |
| `2d6+1` | dice notation, an extension over Perchance; resolved anywhere in entry text |

Names match case-insensitively; spaces in names normalize to hyphens.

## Deliberately excluded

Variables and assignment, functions and inline JavaScript, HTML output,
imports/plugins, and list operations beyond `selectUnique`/`selectMany`.
Unsupported expressions inside `[...]` are left as literal text and reported
as errors rather than silently swallowed.

## Semantics guarantees

- Rolling is deterministic under a seeded RNG: same tables, same seed, same
  output.
- Results are trees, not strings: every `[ref]`, `{choice}`, range, and dice
  roll is an addressable node that can be rerolled in place.
- An in-place reroll retries up to 5 times to produce visibly different text,
  so clicking a part always feels like it did something; plain rolls stay
  unbiased. A node with only one possible outcome returns unchanged.
- A ref to a section that does not exist or that has no entries renders as its
  own literal text and reports an error. A section name declared with nothing
  indented under it is legal and simply has no entries.
- Recursion depth is capped at 10 levels of nesting, counting one level per
  ref hop or nested choice, so a chain of ten tables resolves. Going deeper,
  including cycles, degrades to literal text with an error instead of hanging.
