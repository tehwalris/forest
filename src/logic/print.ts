import type { Options } from "prettier";
import parserTypescript from "prettier/parser-typescript";
import { format as prettierFormat } from "prettier/standalone";
import ts from "typescript";
import { assertNoSyntaxErrors, astFromTypescriptFileContent } from "./parse";
import {
  getTextWithInsertionsAndDeletions,
  InsertionOrDeletion,
  InsertionOrDeletionKind,
} from "./text";

const PRETTIER_OPTIONS: Options = {
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
) {
  const getChildren = (node: ts.Node): ts.Node[] => {
    const children: ts.Node[] = [];
    ts.forEachChild(node, (node) => {
      children.push(node);
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
    visitDeepSynced(childrenA[i], childrenB[i], skip);
  }
}

interface PrettierWrap {
  wrap: true;
  nodeA: ts.Node;
  outerNodeB: ts.Node;
  innerNodeB: ts.Node;
}

interface PrettierUnwrap {
  wrap: false;
  outerNodeA: ts.Node;
  innerNodeA: ts.Node;
  nodeB: ts.Node;
}

type PrettierWrapUnwrap = PrettierWrap | PrettierUnwrap;

function _prettyPrintTsSourceFile(unformattedAst: ts.SourceFile): string {
  const unformattedText = unformattedAst.text;
  const formattedText = prettierFormat(unformattedText, PRETTIER_OPTIONS);

  const formattedAst = assertNoSyntaxErrors(
    astFromTypescriptFileContent(formattedText),
  );

  const wrapUnwraps: PrettierWrapUnwrap[] = [];
  visitDeepSynced(unformattedAst, formattedAst, (nodeA, nodeB) => {
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
        nodeA,
        outerNodeB: nodeB,
        innerNodeB: nodeB.expression,
      });
      return [nodeA, nodeB.expression];
    } else if (
      ts.isParenthesizedExpression(nodeA) &&
      !ts.isParenthesizedExpression(nodeB)
    ) {
      wrapUnwraps.push({
        wrap: false,
        outerNodeA: nodeA,
        innerNodeA: nodeA.expression,
        nodeB,
      });
      return [nodeA.expression, nodeB];
    } else {
      return [nodeA, nodeB];
    }
  });

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
            text: unformattedText
              .slice(wrapUnwrap.outerNodeA.pos, wrapUnwrap.innerNodeA.pos)
              .trim(),
          },
        },
        {
          kind: InsertionOrDeletionKind.Insertion,
          insertion: {
            beforePos: wrapUnwrap.nodeB.end,
            text: unformattedText
              .slice(wrapUnwrap.innerNodeA.end, wrapUnwrap.outerNodeA.end)
              .trim(),
          },
        },
      );
    }
  }

  const adjustedText = getTextWithInsertionsAndDeletions(
    formattedText,
    insertionsAndDeletions,
  );

  console.log("DEBUG", {
    wrapUnwraps,
    insertionsAndDeletions,
    unformattedText,
    formattedText,
    adjustedText,
  });

  return adjustedText;
}

// reprints source file so that text ranges are valid, but does not format it
// very nicely
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
): ts.SourceFile {
  return assertNoSyntaxErrors(
    astFromTypescriptFileContent(_prettyPrintTsSourceFile(unformattedAst)),
  );
}

export function prettyPrintTsString(unformattedText: string): string {
  return _prettyPrintTsSourceFile(
    assertNoSyntaxErrors(astFromTypescriptFileContent(unformattedText)),
  );
}
