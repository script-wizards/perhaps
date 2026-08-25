import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/parse.js";
import { createRng } from "../src/rng.js";
import { Roller } from "../src/roll.js";

const FIXTURES = join(import.meta.dirname, "../../../fixtures");

describe("fixtures", () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));

  it("has fixture files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`parses and rolls every table in ${file}`, () => {
      const tables = parseMarkdown(readFileSync(join(FIXTURES, file), "utf8"), file);
      expect(tables.length).toBeGreaterThan(0);
      const roller = new Roller(tables, createRng(1));
      for (const table of tables) {
        const result = roller.roll(table);
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.errors).toEqual([]);
      }
    });
  }
});
