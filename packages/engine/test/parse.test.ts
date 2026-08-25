import { describe, expect, it } from "vitest";
import { parseBlock, parseEntry, parseMarkdown } from "../src/parse.js";

const BASIC = `
title
  Forest Encounters

output
  You encounter [encounter]

encounter
  a pack of wolves
  a wandering merchant ^2
  bandits
`;

describe("parseBlock", () => {
  it("parses title, sections, and entries", () => {
    const { table, errors } = parseBlock(BASIC);
    expect(errors).toEqual([]);
    expect(table?.title).toBe("Forest Encounters");
    expect(table?.sections.map((s) => s.name)).toEqual(["output", "encounter"]);
    expect(table?.sections[1]?.entries).toHaveLength(3);
  });

  it("parses weights, defaulting to 1", () => {
    const { table } = parseBlock(BASIC);
    const entries = table!.sections[1]!.entries;
    expect(entries[0]).toEqual({ text: "a pack of wolves", weight: 1 });
    expect(entries[1]).toEqual({ text: "a wandering merchant", weight: 2 });
  });

  it("supports decimal weights", () => {
    expect(parseEntry("rare thing ^0.5")).toEqual({ text: "rare thing", weight: 0.5 });
  });

  it("falls back to first section name as title", () => {
    const { table } = parseBlock("loot\n  a sword\n  a shield\n");
    expect(table?.title).toBe("loot");
  });

  it("strips comments but not URLs", () => {
    const { table } = parseBlock(
      "loot\n  // whole line comment\n  a sword // trailing\n  see https://example.com\n",
    );
    const texts = table!.sections[0]!.entries.map((e) => e.text);
    expect(texts).toEqual(["a sword", "see https://example.com"]);
  });

  it("reports entries before any section", () => {
    const { table, errors } = parseBlock("  orphaned entry\n");
    expect(table).toBeNull();
    expect(errors.some((e) => e.includes("before any section"))).toBe(true);
  });
});

describe("parseMarkdown", () => {
  it("extracts perchance and perhaps fences with block indexes", () => {
    const md = [
      "# Notes",
      "```perchance",
      "loot",
      "  gold",
      "```",
      "prose in between",
      "```perhaps",
      "npc",
      "  a guard",
      "```",
    ].join("\n");
    const tables = parseMarkdown(md, "notes.md");
    expect(tables.map((t) => t.title)).toEqual(["loot", "npc"]);
    expect(tables[0]?.source).toEqual({ path: "notes.md", blockIndex: 0 });
    expect(tables[1]?.source).toEqual({ path: "notes.md", blockIndex: 1 });
  });

  it("ignores non-table fences", () => {
    const md = "```js\nconst x = 1\n```\n";
    expect(parseMarkdown(md)).toEqual([]);
  });
});
