export interface RNG {
  next(): number;
}

export interface Entry {
  text: string;
  weight: number;
}

export interface TableSection {
  name: string;
  entries: Entry[];
}

export interface SourceRef {
  path?: string;
  blockIndex?: number;
}

export interface PerhapsTable {
  id: string;
  title: string;
  sections: TableSection[];
  source?: SourceRef;
  errors: string[];
}

export type Node = TextNode | RollNode;

export interface TextNode {
  kind: "text";
  text: string;
}

export type RollKind = "ref" | "choice" | "range" | "dice";

export interface RollDetail {
  ref?: string;
  section?: string;
  entryIndex?: number;
  entryText?: string;
  rolls?: number[];
  value?: number;
}

export interface RollNode {
  kind: RollKind;
  source: string;
  text: string;
  parts: Node[];
  tableId: string;
  detail: RollDetail;
}

export interface RollResult {
  root: RollNode;
  text: string;
  errors: string[];
}
