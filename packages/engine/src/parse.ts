import type { Entry, PerhapsTable, SourceRef, TableSection } from "./types.js";

const WEIGHT_PATTERN = /\s*\^(\d*\.?\d+)\s*$/;
const FENCE_PATTERN = /^(```+|~~~+)\s*(perchance|perhaps)\s*$/;

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function stripComment(line: string): string {
  const match = line.match(/(^|\s)\/\//);
  if (match === null || match.index === undefined) return line;
  return line.slice(0, match.index);
}

export function parseEntry(text: string): Entry {
  const match = text.match(WEIGHT_PATTERN);
  if (match?.[1]) {
    return { text: text.slice(0, match.index).trimEnd(), weight: Number(match[1]) };
  }
  return { text, weight: 1 };
}

export interface ParsedBlock {
  table: PerhapsTable | null;
  errors: string[];
}

export function parseBlock(content: string, source?: SourceRef): ParsedBlock {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const sections: TableSection[] = [];
  const errors: string[] = [];
  let title: string | undefined;
  let current: TableSection | null = null;
  let expectingTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i] ?? "");
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const indented = /^(\t|\s{2,})/.test(line);
    if (indented) {
      if (expectingTitle) {
        title = trimmed;
        expectingTitle = false;
      } else if (current) {
        current.entries.push(parseEntry(trimmed));
      } else {
        errors.push(`line ${i + 1}: entry "${trimmed}" appears before any section name`);
      }
      continue;
    }

    if (line.startsWith(" ")) {
      errors.push(`line ${i + 1}: ambiguous single-space indent`);
      continue;
    }

    if (current) sections.push(current);
    current = null;
    if (normalizeName(trimmed) === "title") {
      expectingTitle = true;
    } else {
      current = { name: trimmed, entries: [] };
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0 || !sections.some((s) => s.entries.length > 0)) {
    return { table: null, errors: [...errors, "no sections with entries found"] };
  }

  const firstSection = sections[0]!;
  const resolvedTitle = title ?? firstSection.name;
  const id = `${source?.path ?? "inline"}:${source?.blockIndex ?? 0}:${normalizeName(resolvedTitle)}`;
  return {
    table: { id, title: resolvedTitle, sections, source, errors },
    errors,
  };
}

export function parseMarkdown(markdown: string, path?: string): PerhapsTable[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const tables: PerhapsTable[] = [];
  let blockIndex = 0;
  let fence: string | null = null;
  let blockLines: string[] = [];

  for (const line of lines) {
    if (fence === null) {
      const open = line.match(FENCE_PATTERN);
      if (open?.[1]) {
        fence = open[1];
        blockLines = [];
      }
      continue;
    }
    if (line.trim() === fence) {
      const parsed = parseBlock(blockLines.join("\n"), { path, blockIndex });
      if (parsed.table) tables.push(parsed.table);
      blockIndex++;
      fence = null;
    } else {
      blockLines.push(line);
    }
  }
  return tables;
}
