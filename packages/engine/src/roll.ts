import { normalizeName } from "./parse.js";
import { createRng } from "./rng.js";
import type {
  Entry,
  Node,
  PerhapsTable,
  RNG,
  RollNode,
  RollResult,
  TableSection,
} from "./types.js";

const MAX_DEPTH = 10;
const REROLL_ATTEMPTS = 5;
const REF_PATTERN =
  /^([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*)(?:\.(selectUnique|selectMany)\((\d+)\))?$/;
const DICE_PATTERN = /\b(\d+)[dD](\d+)([+-]\d+)?\b/g;
const RANGE_PATTERN = /^(\d+)\s*-\s*(\d+)$/;
const LIST_SEPARATOR = ", ";

interface Ctx {
  table: PerhapsTable;
  depth: number;
  errors: string[];
}

export class Roller {
  private byId = new Map<string, PerhapsTable>();
  private byName = new Map<string, PerhapsTable>();

  constructor(
    tables: PerhapsTable[],
    private rng: RNG = createRng(),
  ) {
    for (const table of tables) {
      this.byId.set(table.id, table);
      const name = normalizeName(table.title);
      if (!this.byName.has(name)) this.byName.set(name, table);
    }
  }

  roll(tableOrId: PerhapsTable | string, sectionName?: string): RollResult {
    const table =
      typeof tableOrId === "string"
        ? (this.byId.get(tableOrId) ?? this.byName.get(normalizeName(tableOrId)))
        : tableOrId;
    if (!table) {
      const wanted = typeof tableOrId === "string" ? tableOrId : "unknown";
      return {
        root: {
          kind: "ref",
          source: `[${wanted}]`,
          text: "",
          parts: [],
          tableId: "",
          detail: {},
        },
        text: "",
        errors: [`unknown table "${wanted}"`],
      };
    }

    const section = sectionName
      ? findSection(table, sectionName)
      : (findSection(table, "output") ?? table.sections[0]);
    const ctx: Ctx = { table, depth: 0, errors: [] };
    if (!section || section.entries.length === 0) {
      ctx.errors.push(`table "${table.title}" has no rollable section`);
      const root: RollNode = {
        kind: "ref",
        source: `[${sectionName ?? "output"}]`,
        text: "",
        parts: [],
        tableId: table.id,
        detail: {},
      };
      return { root, text: "", errors: ctx.errors };
    }
    const root = this.rollSection(table, section, ctx);
    return { root, text: root.text, errors: ctx.errors };
  }

  reroll(result: RollResult, path: number[]): RollResult {
    const before = nodeAt(result.root, path)?.text;
    let errors: string[] = [];
    let root = result.root;
    for (let attempt = 0; attempt < REROLL_ATTEMPTS; attempt++) {
      errors = [];
      root = this.rebuildAt(result.root, path, errors);
      if (errors.length > 0 || nodeAt(root, path)?.text !== before) break;
    }
    return { root, text: root.text, errors };
  }

  private rebuildAt(node: RollNode, path: number[], errors: string[]): RollNode {
    if (path.length === 0) return this.reresolve(node, errors);
    const [index, ...rest] = path;
    const child = index === undefined ? undefined : node.parts[index];
    if (!child || child.kind === "text") {
      errors.push(`invalid reroll path at index ${index}`);
      return node;
    }
    const parts = node.parts.slice();
    parts[index!] = this.rebuildAt(child, rest, errors);
    return { ...node, parts, text: joinParts(parts) };
  }

  private reresolve(node: RollNode, errors: string[]): RollNode {
    const table = this.byId.get(node.tableId);
    if (!table) {
      errors.push(`unknown table id "${node.tableId}"`);
      return node;
    }
    const ctx: Ctx = { table, depth: 0, errors };
    const parts = this.resolveText(node.source, ctx);
    const first = parts.find((part): part is RollNode => part.kind !== "text");
    if (!first) {
      errors.push(`could not reroll "${node.source}"`);
      return node;
    }
    return first;
  }

  private rollSection(table: PerhapsTable, section: TableSection, ctx: Ctx): RollNode {
    const index = this.pickIndex(section.entries);
    const entry = section.entries[index]!;
    const inner: Ctx = { ...ctx, depth: ctx.depth + 1 };
    const parts = this.resolveText(entry.text, inner);
    return {
      kind: "ref",
      source: `[${section.name}]`,
      text: joinParts(parts),
      parts,
      tableId: table.id,
      detail: {
        ref: section.name,
        section: section.name,
        entryIndex: index,
        entryText: entry.text,
      },
    };
  }

  private resolveText(text: string, ctx: Ctx): Node[] {
    if (ctx.depth > MAX_DEPTH) {
      ctx.errors.push(`maximum recursion depth reached at "${text}"`);
      return [{ kind: "text", text }];
    }

    const nodes: Node[] = [];
    let literal = "";
    let i = 0;
    while (i < text.length) {
      const char = text[i];
      if (char === "[") {
        const close = text.indexOf("]", i);
        if (close === -1) {
          literal += text.slice(i);
          break;
        }
        this.flushLiteral(literal, nodes, ctx);
        literal = "";
        nodes.push(this.resolveRef(text.slice(i, close + 1), ctx));
        i = close + 1;
      } else if (char === "{") {
        const close = matchBrace(text, i);
        if (close === -1) {
          literal += text.slice(i);
          break;
        }
        this.flushLiteral(literal, nodes, ctx);
        literal = "";
        nodes.push(this.resolveBraces(text.slice(i, close + 1), ctx));
        i = close + 1;
      } else {
        literal += char;
        i++;
      }
    }
    this.flushLiteral(literal, nodes, ctx);
    return nodes;
  }

  private flushLiteral(literal: string, nodes: Node[], ctx: Ctx): void {
    if (literal === "") return;
    let last = 0;
    DICE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DICE_PATTERN.exec(literal)) !== null) {
      if (match.index > last) {
        nodes.push({ kind: "text", text: literal.slice(last, match.index) });
      }
      nodes.push(this.rollDice(match, ctx));
      last = match.index + match[0].length;
    }
    if (last < literal.length) {
      nodes.push({ kind: "text", text: literal.slice(last) });
    }
  }

  private rollDice(match: RegExpExecArray, ctx: Ctx): RollNode {
    const count = Number(match[1]);
    const sides = Number(match[2]);
    const modifier = match[3] ? Number(match[3]) : 0;
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(this.rng.next() * sides));
    }
    const value = rolls.reduce((a, b) => a + b, 0) + modifier;
    return {
      kind: "dice",
      source: match[0],
      text: String(value),
      parts: [{ kind: "text", text: String(value) }],
      tableId: ctx.table.id,
      detail: { rolls, value },
    };
  }

  private resolveRef(source: string, ctx: Ctx): Node {
    const expression = source.slice(1, -1).trim();
    const match = expression.match(REF_PATTERN);
    if (!match?.[1]) {
      ctx.errors.push(`unsupported expression "${source}"`);
      return { kind: "text", text: source };
    }
    const [, name, method, countText] = match;

    const target = this.findTarget(ctx.table, name);
    if (!target) {
      ctx.errors.push(`unknown reference "[${name}]"`);
      return { kind: "text", text: source };
    }

    if (!method) {
      const node = this.rollSection(target.table, target.section, {
        ...ctx,
        table: target.table,
        depth: ctx.depth + 1,
      });
      return { ...node, source, detail: { ...node.detail, ref: name } };
    }

    const requested = Number(countText);
    const unique = method === "selectUnique";
    const pool = target.section.entries.map((entry, index) => ({ entry, index }));
    const count = unique ? Math.min(requested, pool.length) : requested;
    const parts: Node[] = [];
    for (let i = 0; i < count; i++) {
      const poolIndex = this.pickIndex(pool.map((p) => p.entry));
      const picked = pool[poolIndex]!;
      if (unique) pool.splice(poolIndex, 1);
      if (parts.length > 0) parts.push({ kind: "text", text: LIST_SEPARATOR });
      const inner: Ctx = { ...ctx, table: target.table, depth: ctx.depth + 1 };
      const resolved = this.resolveText(picked.entry.text, inner);
      parts.push({
        kind: "ref",
        source: `[${name}]`,
        text: joinParts(resolved),
        parts: resolved,
        tableId: target.table.id,
        detail: {
          ref: name,
          section: target.section.name,
          entryIndex: picked.index,
          entryText: picked.entry.text,
        },
      });
    }
    return {
      kind: "ref",
      source,
      text: joinParts(parts),
      parts,
      tableId: ctx.table.id,
      detail: { ref: name, section: target.section.name },
    };
  }

  private resolveBraces(source: string, ctx: Ctx): Node {
    const inner = source.slice(1, -1);
    const branches = splitBranches(inner);

    if (branches.length === 1) {
      const range = branches[0]!.match(RANGE_PATTERN);
      if (range) {
        const low = Number(range[1]);
        const high = Number(range[2]);
        const value = low + Math.floor(this.rng.next() * (high - low + 1));
        return {
          kind: "range",
          source,
          text: String(value),
          parts: [{ kind: "text", text: String(value) }],
          tableId: ctx.table.id,
          detail: { value },
        };
      }
    }

    const entries = branches.map((branch) => parseBranch(branch));
    const index = this.pickIndex(entries);
    const chosen = entries[index]!;
    const innerCtx: Ctx = { ...ctx, depth: ctx.depth + 1 };
    const parts = this.resolveText(chosen.text, innerCtx);
    return {
      kind: "choice",
      source,
      text: joinParts(parts),
      parts,
      tableId: ctx.table.id,
      detail: { entryIndex: index, entryText: chosen.text },
    };
  }

  private findTarget(
    table: PerhapsTable,
    name: string | undefined,
  ): { table: PerhapsTable; section: TableSection } | null {
    if (!name) return null;
    const local = findSection(table, name);
    if (local) return { table, section: local };
    const external = this.byName.get(normalizeName(name));
    if (external) {
      const section =
        findSection(external, "output") ?? external.sections[0] ?? null;
      if (section) return { table: external, section };
    }
    return null;
  }

  private pickIndex(entries: readonly Entry[]): number {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let remaining = this.rng.next() * total;
    for (let i = 0; i < entries.length; i++) {
      remaining -= entries[i]!.weight;
      if (remaining < 0) return i;
    }
    return entries.length - 1;
  }
}

function nodeAt(root: RollNode, path: number[]): Node | null {
  let node: Node = root;
  for (const index of path) {
    if (node.kind === "text") return null;
    const child: Node | undefined = node.parts[index];
    if (!child) return null;
    node = child;
  }
  return node;
}

function findSection(table: PerhapsTable, name: string): TableSection | null {
  const wanted = normalizeName(name);
  return table.sections.find((s) => normalizeName(s.name) === wanted) ?? null;
}

function joinParts(parts: readonly Node[]): string {
  return parts.map((part) => part.text).join("");
}

function matchBrace(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitBranches(inner: string): string[] {
  const branches: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of inner) {
    if (char === "{") depth++;
    else if (char === "}") depth--;
    if (char === "|" && depth === 0) {
      branches.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  branches.push(current);
  return branches;
}

function parseBranch(branch: string): Entry {
  const match = branch.match(/\s*\^(\d*\.?\d+)\s*$/);
  if (match?.[1]) {
    return { text: branch.slice(0, match.index).trimEnd(), weight: Number(match[1]) };
  }
  return { text: branch, weight: 1 };
}
