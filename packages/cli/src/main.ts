#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  createRng,
  normalizeName,
  parseMarkdown,
  Roller,
} from "@scriptwizards/perhaps-engine";

function usage(): never {
  console.error("usage: perhaps <file.md> [table] [--seed n] [--list]");
  process.exit(2);
}

const args = process.argv.slice(2);
const positional: string[] = [];
let seed: number | undefined;
let list = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--seed") {
    seed = Number(args[++i]);
  } else if (arg === "--list") {
    list = true;
  } else if (arg?.startsWith("-")) {
    usage();
  } else if (arg) {
    positional.push(arg);
  }
}

const [file, tableName] = positional;
if (file === undefined) usage();

const tables = parseMarkdown(readFileSync(file, "utf8"), file);
if (tables.length === 0) {
  console.error(`no perhaps/perchance tables found in ${file}`);
  process.exit(1);
}

if (list) {
  for (const table of tables) console.log(table.title);
  process.exit(0);
}

const table = tableName
  ? tables.find((t) => normalizeName(t.title) === normalizeName(tableName))
  : tables[0];
if (!table) {
  console.error(`table "${tableName}" not found; use --list to see tables`);
  process.exit(1);
}

const roller = new Roller(tables, createRng(seed));
const result = roller.roll(table);
console.log(result.text);
for (const error of result.errors) console.error(`warning: ${error}`);
