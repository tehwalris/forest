// src/logic/tree/display-line.ts

type TightNode = any;
type PortalNode = any;

enum DocKind {
  Nest,
  Leaf,
  Line,
  Group,
}

export type Doc = Doc[] | NestDoc | LeafDoc | LineDoc | GroupDoc;

interface NestDoc {
  kind: DocKind.Nest;
  amount: number;
  content: Doc;
}

interface LeafDoc {
  kind: DocKind.Leaf;
  content: TightNode | PortalNode;
  considerEmpty: boolean;
}

export enum LineKind {
  Normal,
  Soft,
  Hard,
}

interface LineDoc {
  kind: DocKind.Line;
  lineKind: LineKind;
}

interface GroupDoc {
  kind: DocKind.Group;
  content: Doc;
  break: boolean;
}
