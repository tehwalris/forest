import { NodeKind, PortalNode, Split, TightNode } from "divetree-core";
import { unreachable } from "../util";

enum DocKind {
  Nest,
  Leaf,
  Line,
  Group,
}

export type Doc = NestDoc | LeafDoc | LineDoc | GroupDoc;

interface NestDoc {
  kind: DocKind.Nest;
  amount: number;
  content: Doc;
}

interface LeafDoc {
  kind: DocKind.Leaf;
  content: TightNode | PortalNode;
}

interface LineDoc {
  kind: DocKind.Line;
}

interface GroupDoc {
  kind: DocKind.Group;
  content: Doc[];
}

export function nestDoc(amount: number, content: Doc): Doc {
  return { kind: DocKind.Nest, amount, content };
}

export function leafDoc(content: TightNode | PortalNode): Doc {
  return { kind: DocKind.Leaf, content };
}

export function lineDoc(): Doc {
  return { kind: DocKind.Line };
}

export function groupDoc(content: Doc[]): Doc {
  return { kind: DocKind.Group, content };
}

interface Line {
  indent: number;
  content: (TightNode | PortalNode)[];
}

function linesFromDoc(doc: Doc): Line[] {
  switch (doc.kind) {
    case DocKind.Nest: {
      const lines = linesFromDoc(doc.content);
      if (!lines.length) {
        return lines;
      }
      return [
        lines[0],
        ...lines.slice(1).map((l) => ({
          ...l,
          indent: l.indent + doc.amount,
        })),
      ];
    }
    case DocKind.Leaf:
      return [{ indent: 0, content: [doc.content] }];
    case DocKind.Line:
      return [{ indent: 0, content: [] }];
    case DocKind.Group:
      return doc.content.flatMap((c) => linesFromDoc(c));
    default:
      return unreachable(doc);
  }
}

export function divetreeFromDoc(doc: Doc): TightNode {
  return {
    kind: NodeKind.TightSplit,
    split: Split.Stacked,
    growLast: true,
    children: linesFromDoc(doc).map((line) => ({
      kind: NodeKind.TightSplit,
      split: Split.SideBySide,
      growLast: true,
      // TODO indent
      children: line.content,
    })),
  };
}
