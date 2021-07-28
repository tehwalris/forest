import {
  NodeKind,
  PortalNode,
  Split,
  TightLeafNode,
  TightNode,
  TightSplitNode,
} from "divetree-core";
import { unreachable } from "../util";
import * as R from "ramda";
import { arrayFromTextSize } from "../text-measurement";

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

export function groupDoc(content: Doc): Doc {
  return { kind: DocKind.Group, content };
}

interface Line {
  indent: number;
  content: (TightNode | PortalNode)[];
}

export function docIsOnlySoftLinesOrEmpty(doc: Doc): boolean {
  if (Array.isArray(doc)) {
    return doc.every((c) => docIsOnlySoftLinesOrEmpty(c));
  }
  switch (doc.kind) {
    case DocKind.Nest: {
      return docIsOnlySoftLinesOrEmpty(doc.content);
    }
    case DocKind.Leaf:
      return doc.considerEmpty;
    case DocKind.Line:
      return doc.lineKind === LineKind.Soft;
    case DocKind.Group:
      return docIsOnlySoftLinesOrEmpty(doc.content);
    default:
      unreachable(doc);
  }
}

enum PrintBreakMode {
  Flat,
  Break,
}

function measureDivetreeNodeWidth(
  node: TightNode | PortalNode,
): number | undefined {
  switch (node.kind) {
    case NodeKind.Portal:
      return undefined;
    case NodeKind.TightSplit:
      if (!node.children.length) {
        return 0;
      }
      const childWidths = node.children.map((c) => measureDivetreeNodeWidth(c));
      if (childWidths.some((w) => w === undefined)) {
        return undefined;
      }
      const aggregationFunction: (widths: number[]) => number =
        node.split === Split.SideBySide
          ? R.sum
          : (widths: number[]) => Math.max(...widths);
      return aggregationFunction(childWidths.map((w) => w!));
    case NodeKind.TightLeaf:
      return node.size[0];
    default:
      return unreachable(node);
  }
}

const spaceWidth = 10;

function fits(
  doc: Doc,
  mode: PrintBreakMode,
  originalRemainingWidth: number,
): boolean {
  let remainingWidth = originalRemainingWidth;
  interface InternalCommand {
    doc: Doc | "popIndent";
    mode: PrintBreakMode;
  }
  const commands: InternalCommand[] = [{ doc, mode }];
  const indentStack: number[] = [0];
  while (remainingWidth >= 0) {
    if (!commands.length) {
      return true;
    }
    const { doc, mode } = commands.pop()!;
    if (doc === "popIndent") {
      indentStack.pop();
      continue;
    }
    if (Array.isArray(doc)) {
      commands.push(...R.reverse(doc).map((c) => ({ doc: c, mode })));
      continue;
    }
    switch (doc.kind) {
      case DocKind.Nest: {
        indentStack.push(R.last(indentStack)! + doc.amount);
        remainingWidth -= doc.amount;
        commands.push({ doc: "popIndent", mode });
        commands.push({ doc: doc.content, mode });
        break;
      }
      case DocKind.Leaf: {
        if (doc.considerEmpty) {
          break;
        }
        const width = measureDivetreeNodeWidth(doc.content);
        if (width === undefined) {
          return false;
        }
        remainingWidth -= width;
        break;
      }
      case DocKind.Line: {
        if (mode === PrintBreakMode.Break || doc.lineKind === LineKind.Hard) {
          return true;
        }
        if (doc.lineKind === LineKind.Normal) {
          remainingWidth = originalRemainingWidth - R.last(indentStack)!;
        }
        break;
      }
      case DocKind.Group: {
        commands.push({ doc: doc.content, mode });
        break;
      }
      default: {
        return unreachable(doc);
      }
    }
  }
  return false;
}

function linesFromDoc(rootDoc: Doc): Line[] {
  interface InternalCommand {
    doc: Doc | "popIndent";
    mode: PrintBreakMode;
  }

  const maxLineWidth = 300;

  const docQueue: InternalCommand[] = [
    { doc: rootDoc, mode: PrintBreakMode.Break },
  ];
  let currentLine: Line = { indent: 0, content: [] };
  let currentPos: number | undefined = currentLine.indent;
  const output: Line[] = [currentLine];
  const indentStack: number[] = [0];
  while (docQueue.length) {
    const { doc, mode } = docQueue.pop()!;
    if (doc === "popIndent") {
      indentStack.pop();
      if (indentStack.length < 1) {
        throw new Error("indent stack underflow");
      }
      continue;
    }
    if (Array.isArray(doc)) {
      docQueue.push(...R.reverse(doc).map((c) => ({ doc: c, mode })));
      continue;
    }
    switch (doc.kind) {
      case DocKind.Nest: {
        indentStack.push(R.last(indentStack)! + doc.amount);
        docQueue.push({ doc: "popIndent", mode });
        docQueue.push({ doc: doc.content, mode });
        break;
      }
      case DocKind.Leaf: {
        const width = measureDivetreeNodeWidth(doc.content);
        currentPos =
          currentPos === undefined || width === undefined
            ? undefined
            : currentPos + width;
        currentLine.content.push(doc.content);
        break;
      }
      case DocKind.Line: {
        if (mode === PrintBreakMode.Break || doc.lineKind === LineKind.Hard) {
          const newLine: Line = { indent: R.last(indentStack)!, content: [] };
          output.push(newLine);
          currentLine = newLine;
          currentPos = newLine.indent;
        } else if (
          mode === PrintBreakMode.Flat &&
          doc.lineKind === LineKind.Normal
        ) {
          // TODO use the real width of a space
          currentLine.content.push({
            kind: NodeKind.TightLeaf,
            size: [spaceWidth, 0],
          });
          if (currentPos !== undefined) {
            currentPos += spaceWidth;
          }
        }
        break;
      }
      case DocKind.Group: {
        const newMode =
          mode === PrintBreakMode.Break &&
          (currentPos === undefined ||
            !fits(doc, PrintBreakMode.Flat, maxLineWidth - currentPos))
            ? PrintBreakMode.Break
            : PrintBreakMode.Flat;
        docQueue.push({ doc: doc.content, mode: newMode });
        break;
      }
      default: {
        return unreachable(doc);
      }
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
    children: [
      ...linesFromDoc(doc).map(
        (line): TightSplitNode => ({
          kind: NodeKind.TightSplit,
          split: Split.SideBySide,
          growLast: true,
          children: [
            ...makeIndentNodes(line.indent),
            ...line.content,
            { kind: NodeKind.TightLeaf, size: [0, 0] },
          ],
        }),
      ),
      { kind: NodeKind.TightLeaf, size: [0, 0] },
    ],
  };
}
