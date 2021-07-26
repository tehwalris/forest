import {
  NodeKind,
  PortalNode,
  Split,
  TightLeafNode,
  TightNode,
} from "divetree-core";
import { unreachable } from "../util";
import * as R from "ramda";

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
  considerEmpty: boolean;
}

export enum LineKind {
  Normal,
  Soft,
}

interface LineDoc {
  kind: DocKind.Line;
  lineKind: LineKind;
}

interface GroupDoc {
  kind: DocKind.Group;
  content: Doc[];
}

export function nestDoc(amount: number, content: Doc): Doc {
  return { kind: DocKind.Nest, amount, content };
}

export function leafDoc(
  content: TightNode | PortalNode,
  considerEmpty: boolean = false,
): Doc {
  return { kind: DocKind.Leaf, content, considerEmpty };
}

export function lineDoc(lineKind: LineKind = LineKind.Normal): Doc {
  return { kind: DocKind.Line, lineKind };
}

export function groupDoc(content: Doc[]): Doc {
  return { kind: DocKind.Group, content };
}

interface Line {
  indent: number;
  content: (TightNode | PortalNode)[];
}

export function docIsOnlySoftLinesOrEmpty(doc: Doc): boolean {
  switch (doc.kind) {
    case DocKind.Nest: {
      return docIsOnlySoftLinesOrEmpty(doc.content);
    }
    case DocKind.Leaf:
      return doc.considerEmpty;
    case DocKind.Line:
      return doc.lineKind === LineKind.Soft;
    case DocKind.Group:
      return doc.content.every((c) => docIsOnlySoftLinesOrEmpty(c));
    default:
      unreachable(doc);
  }
}

function linesFromDoc(rootDoc: Doc): Line[] {
  const docQueue: (Doc | "popIndent")[] = [rootDoc];
  let currentLine: Line = { indent: 0, content: [] };
  const output: Line[] = [currentLine];
  let nextIndent = 0;
  const indentStack: number[] = [];
  while (docQueue.length) {
    const doc = docQueue.pop()!;
    if (doc === "popIndent") {
      const poppedIndent = indentStack.pop();
      if (poppedIndent === undefined) {
        throw new Error("indent stack underflow");
      }
      nextIndent = poppedIndent;
      continue;
    }
    switch (doc.kind) {
      case DocKind.Nest: {
        indentStack.push(nextIndent);
        nextIndent += doc.amount;
        docQueue.push("popIndent");
        docQueue.push(doc.content);
        break;
      }
      case DocKind.Leaf:
        currentLine.content.push(doc.content);
        break;
      case DocKind.Line:
        const newLine: Line = { indent: nextIndent, content: [] };
        output.push(newLine);
        currentLine = newLine;
        break;
      case DocKind.Group:
        if (docIsOnlySoftLinesOrEmpty(doc)) {
          docQueue.push(
            ...R.reverse(doc.content.filter((c) => c.kind !== DocKind.Line)),
          );
        } else {
          docQueue.push(...R.reverse(doc.content));
        }
        break;
      default:
        unreachable(doc);
    }
  }
  return output;
}

function makeIndentNodes(indent: number): TightLeafNode[] {
  if (indent === 0) {
    return [];
  } else if (indent > 0) {
    return [{ kind: NodeKind.TightLeaf, size: [indent * 10, 0] }];
  } else {
    throw new Error("indent must be non-negative");
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
      children: [...makeIndentNodes(line.indent), ...line.content],
    })),
  };
}
