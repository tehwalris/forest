import type { Options as PrettierOptions } from "prettier";
import parserTypescript from "prettier/parser-typescript";
import { format as prettierFormat } from "prettier/standalone";
import ts from "typescript";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { trimRange } from "./node-from-ts";
import { assertNoSyntaxErrors, astFromTypescriptFileContent } from "./parse";
import {
  getTextWithInsertionsAndDeletions,
  InsertionOrDeletion,
  InsertionOrDeletionKind,
} from "./text";
import { nodesAreEqualExceptRangesAndPlaceholdersAndIds } from "./tree-utils/equal";
export const defaultPrettierOptions: PrettierOptions = {
  parser: "typescript",
  printWidth: 80,
  trailingComma: "all",
  plugins: [parserTypescript],
};
function createPrinter() {
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
}
function visitDeepSynced(
  nodeA: ts.Node,
  nodeB: ts.Node,
  skip: (nodeA: ts.Node, nodeB: ts.Node) => [ts.Node, ts.Node],
  shouldVisitChild: (child: ts.Node, parent: ts.Node) => boolean,
) {
  const getChildren = (node: ts.Node): ts.Node[] => {
    const children: ts.Node[] = [];
    ts.forEachChild(node, (child) => {
      if (shouldVisitChild(child, node)) {
        children.push(child);
      }
    });
    return children;
  };
  [nodeA, nodeB] = skip(nodeA, nodeB);
  const childrenA = getChildren(nodeA);
  const childrenB = getChildren(nodeB);
  if (childrenA.length !== childrenB.length) {
    throw new Error("unequal number of children");
  }
  for (let i = 0; i < childrenA.length; i++) {
    visitDeepSynced(childrenA[i], childrenB[i], skip, shouldVisitChild);
  }
}
interface PrettierWrap {
  wrap: true;
  nodeA: ts.TextRange;
  outerNodeB: ts.TextRange;
  innerNodeB: ts.TextRange;
}
interface PrettierUnwrap {
  wrap: false;
  outerNodeA: ts.TextRange;
  innerNodeA: ts.TextRange;
  nodeB: ts.TextRange;
}
type PrettierWrapUnwrap = PrettierWrap | PrettierUnwrap;
function _prettyPrintTsSourceFile(
  unformattedAst: ts.SourceFile,
  prettierOptions: PrettierOptions,
): string {
  const unformattedText = unformattedAst.text;
  const formattedText = prettierFormat(unformattedText, prettierOptions);
  const formattedAst = assertNoSyntaxErrors(
    astFromTypescriptFileContent(formattedText),
  );
  const wrapUnwraps: PrettierWrapUnwrap[] = [];
  visitDeepSynced(
    unformattedAst,
    formattedAst,
    (nodeA, nodeB) => {
      if (
        nodeA.pos === -1 ||
        nodeA.end === -1 ||
        nodeB.pos === -1 ||
        nodeB.end === -1
      ) {
        throw new Error("nodes have invalid text ranges");
      }
      if (
        !ts.isParenthesizedExpression(nodeA) &&
        ts.isParenthesizedExpression(nodeB)
      ) {
        wrapUnwraps.push({
          wrap: true,
          nodeA: trimRange(nodeA, unformattedText),
          outerNodeB: trimRange(nodeB, formattedText),
          innerNodeB: trimRange(nodeB.expression, formattedText),
        });
        return [nodeA, nodeB.expression];
      } else if (
        ts.isParenthesizedExpression(nodeA) &&
        !ts.isParenthesizedExpression(nodeB)
      ) {
        wrapUnwraps.push({
          wrap: false,
          outerNodeA: trimRange(nodeA, unformattedText),
          innerNodeA: trimRange(nodeA.expression, unformattedText),
          nodeB: trimRange(nodeB, formattedText),
        });
        return [nodeA.expression, nodeB];
      } else {
        return [nodeA, nodeB];
      }
    },
    (child, parent) =>
      !(
        ts.isEmptyStatement(child) &&
        (ts.isBlock(parent) || ts.isSourceFile(parent))
      ),
  );
  const insertionsAndDeletions: InsertionOrDeletion[] = [];
  for (const wrapUnwrap of wrapUnwraps) {
    if (wrapUnwrap.wrap) {
      insertionsAndDeletions.push(
        {
          kind: InsertionOrDeletionKind.Deletion,
          textRange: {
            pos: wrapUnwrap.outerNodeB.pos,
            end: wrapUnwrap.innerNodeB.pos,
          },
        },
        {
          kind: InsertionOrDeletionKind.Deletion,
          textRange: {
            pos: wrapUnwrap.innerNodeB.end,
            end: wrapUnwrap.outerNodeB.end,
          },
        },
      );
    } else {
      insertionsAndDeletions.push(
        {
          kind: InsertionOrDeletionKind.Insertion,
          insertion: {
            beforePos: wrapUnwrap.nodeB.pos,
            duplicateIndex: 0,
            text: unformattedText
              .slice(wrapUnwrap.outerNodeA.pos, wrapUnwrap.innerNodeA.pos)
              .trim(),
          },
        },
        {
          kind: InsertionOrDeletionKind.Insertion,
          insertion: {
            beforePos: wrapUnwrap.nodeB.end,
            duplicateIndex: 0,
            text: unformattedText
              .slice(wrapUnwrap.innerNodeA.end, wrapUnwrap.outerNodeA.end)
              .trim(),
          },
        },
      );
    }
  }
  return getTextWithInsertionsAndDeletions(
    formattedText,
    insertionsAndDeletions,
  );
}
export function uglyPrintTsSourceFile(
  unformattedAst: ts.SourceFile,
): ts.SourceFile {
  const printer = createPrinter();
  return assertNoSyntaxErrors(
    astFromTypescriptFileContent(
      printer.printNode(ts.EmitHint.SourceFile, unformattedAst, unformattedAst),
    ),
  );
}
export function prettyPrintTsSourceFile(
  unformattedAst: ts.SourceFile,
  prettierOptions: PrettierOptions,
): ts.SourceFile {
  return assertNoSyntaxErrors(
    astFromTypescriptFileContent(
      _prettyPrintTsSourceFile(unformattedAst, prettierOptions),
    ),
  );
}
export function prettyPrintTsString(
  unformattedText: string,
  prettierOptions: PrettierOptions,
): string {
  return _prettyPrintTsSourceFile(
    assertNoSyntaxErrors(astFromTypescriptFileContent(unformattedText)),
    prettierOptions,
  );
}
export function prettyPrinterAdjustedEquality(a: Node, b: Node): boolean {
  return nodesAreEqualExceptRangesAndPlaceholdersAndIds(
    a,
    b,
    (ca, cb, ka, _kb, pa, _pb) => {
      if (
        pa &&
        pa.kind === NodeKind.List &&
        pa.listKind === ListKind.TsNodeStruct &&
        pa.tsNode &&
        ts.isArrowFunction(pa.tsNode) &&
        ka === "parameters" &&
        ca.kind === NodeKind.List &&
        cb.kind === NodeKind.List
      ) {
        const adjustList = (l: ListNode): ListNode => ({
          ...l,
          delimiters: ["(", ")"],
          equivalentToContent: false,
        });
        return prettyPrinterAdjustedEquality(adjustList(ca), adjustList(cb));
      }
      return undefined;
    },
  );
}
