import { describe, expect, it } from "vitest";
import { parseBlock } from "../src/parse.js";
import { createRng } from "../src/rng.js";
import { Roller } from "../src/roll.js";
import type { RNG, RollNode } from "../src/types.js";

function sequence(...values: number[]): RNG {
  let i = 0;
  return { next: () => values[i++ % values.length]! };
}

function table(block: string) {
  const { table: parsed } = parseBlock(block);
  if (!parsed) throw new Error("fixture failed to parse");
  return parsed;
}

describe("basic rolling", () => {
  const forest = table(`
title
  Forest
output
  You encounter [encounter]
encounter
  wolves
  a merchant
`);

  it("rolls output and resolves refs", () => {
    const roller = new Roller([forest], sequence(0, 0));
    const result = roller.roll(forest);
    expect(result.text).toBe("You encounter wolves");
    expect(result.errors).toEqual([]);
  });

  it("selects entries by rng value", () => {
    const roller = new Roller([forest], sequence(0, 0.9));
    expect(roller.roll(forest).text).toBe("You encounter a merchant");
  });

  it("rolls a named section directly", () => {
    const roller = new Roller([forest], sequence(0));
    expect(roller.roll(forest, "encounter").text).toBe("wolves");
  });

  it("reports unknown refs as errors, keeping literal text", () => {
    const broken = table("output\n  a [missing] thing\n");
    const result = new Roller([broken], sequence(0)).roll(broken);
    expect(result.text).toBe("a [missing] thing");
    expect(result.errors[0]).toContain("unknown reference");
  });

  it("reports unsupported expressions instead of swallowing them", () => {
    const fancy = table("output\n  [x = 5]\n");
    const result = new Roller([fancy], sequence(0)).roll(fancy);
    expect(result.errors[0]).toContain("unsupported expression");
    expect(result.text).toBe("[x = 5]");
  });
});

describe("weights", () => {
  const weighted = table("output\n  common ^3\n  rare\n");

  it("respects weight boundaries", () => {
    expect(new Roller([weighted], sequence(0.74)).roll(weighted).text).toBe("common");
    expect(new Roller([weighted], sequence(0.76)).roll(weighted).text).toBe("rare");
  });
});

describe("inline constructs", () => {
  it("resolves choices", () => {
    const t = table("output\n  a {red|blue} door\n");
    expect(new Roller([t], sequence(0, 0)).roll(t).text).toBe("a red door");
    expect(new Roller([t], sequence(0, 0.9)).roll(t).text).toBe("a blue door");
  });

  it("respects choice weights", () => {
    const t = table("output\n  {common^3|rare}\n");
    expect(new Roller([t], sequence(0, 0.74)).roll(t).text).toBe("common");
    expect(new Roller([t], sequence(0, 0.76)).roll(t).text).toBe("rare");
  });

  it("resolves nested choices", () => {
    const t = table("output\n  {a {big|small} dog|a cat}\n");
    expect(new Roller([t], sequence(0, 0, 0.9)).roll(t).text).toBe("a small dog");
  });

  it("resolves integer ranges inclusively", () => {
    const t = table("output\n  {3-8} goblins\n");
    expect(new Roller([t], sequence(0, 0)).roll(t).text).toBe("3 goblins");
    expect(new Roller([t], sequence(0, 0.999)).roll(t).text).toBe("8 goblins");
  });

  it("resolves dice notation with modifiers", () => {
    const t = table("output\n  2d6+1 gold\n");
    const result = new Roller([t], sequence(0, 0, 0.999)).roll(t);
    expect(result.text).toBe("8 gold");
    const dice = result.root.parts[0] as RollNode;
    expect(dice.kind).toBe("dice");
    expect(dice.detail.rolls).toEqual([1, 6]);
  });
});

describe("select methods", () => {
  const gems = table(`
output
  you find [gem.selectUnique(2)]
gem
  ruby
  emerald
  sapphire
`);

  it("selectUnique never repeats", () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = new Roller([gems], createRng(seed)).roll(gems);
      const found = result.text.replace("you find ", "").split(", ");
      expect(new Set(found).size).toBe(2);
    }
  });

  it("selectUnique caps at pool size", () => {
    const t = table("output\n  [gem.selectUnique(9)]\ngem\n  ruby\n  emerald\n");
    const result = new Roller([t], sequence(0, 0, 0)).roll(t);
    expect(result.text.split(", ")).toHaveLength(2);
  });

  it("selectMany allows repeats", () => {
    const t = table("output\n  [gem.selectMany(3)]\ngem\n  ruby\n  emerald\n");
    const result = new Roller([t], sequence(0, 0, 0, 0)).roll(t);
    expect(result.text).toBe("ruby, ruby, ruby");
  });
});

describe("cross-table references", () => {
  it("resolves refs to other tables by title", () => {
    const encounters = table("output\n  wolves guarding [treasure]\n");
    const treasure = table("title\n  Treasure\noutput\n  a gem\n");
    const roller = new Roller([encounters, treasure], sequence(0));
    expect(roller.roll(encounters).text).toBe("wolves guarding a gem");
  });

  it("accepts spaces in ref names, normalized to hyphens", () => {
    const encounters = table("output\n  overheard: [tavern trouble]\n");
    const tavern = table("title\n  Tavern Trouble\noutput\n  a brawl\n");
    const roller = new Roller([encounters, tavern], sequence(0));
    const result = roller.roll(encounters);
    expect(result.text).toBe("overheard: a brawl");
    expect(result.errors).toEqual([]);
  });
});

describe("safety", () => {
  it("caps recursion on cycles instead of hanging", () => {
    const t = table("output\n  [loop]\nloop\n  again [loop]\n");
    const result = new Roller([t], sequence(0)).roll(t);
    expect(result.errors.some((e) => e.includes("recursion"))).toBe(true);
  });
});

describe("determinism", () => {
  const forest = table(`
output
  [encounter] with {2-12} gold and 2d6 arrows
encounter
  wolves ^2
  a {red|blue} knight
  [gem.selectUnique(2)]
gem
  ruby
  emerald
  sapphire
`);

  it("same seed, same output", () => {
    const a = new Roller([forest], createRng(42)).roll(forest);
    const b = new Roller([forest], createRng(42)).roll(forest);
    expect(a.text).toBe(b.text);
    expect(a).toEqual(b);
  });
});

describe("reroll", () => {
  const forest = table(`
output
  [encounter] near {2-8} trees
encounter
  wolves
  a merchant
`);

  it("rerolls one node in place, preserving the rest", () => {
    const roller = new Roller([forest], sequence(0, 0, 0.9, 0.9));
    const first = roller.roll(forest);
    expect(first.text).toBe("wolves near 8 trees");

    const rerolled = roller.reroll(first, [0]);
    expect(rerolled.text).toBe("a merchant near 8 trees");
    expect((rerolled.root.parts[2] as RollNode).text).toBe("8");
  });

  it("retries until the rerolled part visibly changes", () => {
    const roller = new Roller([forest], sequence(0, 0, 0.9, 0, 0, 0.9));
    const first = roller.roll(forest);
    expect(first.text).toBe("wolves near 8 trees");
    const rerolled = roller.reroll(first, [0]);
    expect(rerolled.text).toBe("a merchant near 8 trees");
  });

  it("gives up retrying when only one outcome exists", () => {
    const only = table("output\n  [thing] here\nthing\n  the same\n");
    const roller = new Roller([only], sequence(0));
    const first = roller.roll(only);
    const rerolled = roller.reroll(first, [0]);
    expect(rerolled.text).toBe("the same here");
    expect(rerolled.errors).toEqual([]);
  });

  it("rejects invalid paths", () => {
    const roller = new Roller([forest], sequence(0));
    const first = roller.roll(forest);
    const result = roller.reroll(first, [99]);
    expect(result.errors[0]).toContain("invalid reroll path");
  });
});
