import type { Options } from "prettier";
import parserTypescript from "prettier/parser-typescript";
import { format as prettierFormat } from "prettier/standalone";
import ts from "typescript";
import { astFromTypescriptFileContent } from "./parse";
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

function isNodeArray(
  nodeOrNodeArray: ts.Node | ts.NodeArray<ts.Node>,
): nodeOrNodeArray is ts.NodeArray<ts.Node> {
  return Array.isArray(nodeOrNodeArray);
}

function visitDeepSynced(
  nodeA: ts.Node,
  nodeB: ts.Node,
  skip: (nodeA: ts.Node, nodeB: ts.Node) => [ts.Node, ts.Node],
) {
  type Child = ts.Node | ts.NodeArray<ts.Node>;

  const getChildren = (node: ts.Node): Child[] => {
    const children: Child[] = [];
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
    const childA = childrenA[i];
    const childB = childrenB[i];
    if (isNodeArray(childA) && isNodeArray(childB)) {
      if (childA.length !== childB.length) {
        throw new Error("NodeArrays childA and childB have unequal length");
      }
      for (let j = 0; j < childA.length; j++) {
        visitDeepSynced(childA[j], childB[j], skip);
      }
    } else if (!isNodeArray(childA) && !isNodeArray(childB)) {
      visitDeepSynced(childA, childB, skip);
    } else {
      throw new Error(
        "childA and childB must either both be Node or be NodeArray",
      );
    }
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

export function prettyPrintTsSourceFile(
  unformattedAst: ts.SourceFile,
): ts.SourceFile {
  const printer = createPrinter();
  const unformattedText = printer.printNode(
    ts.EmitHint.SourceFile,
    unformattedAst,
    unformattedAst,
  );
  const formattedText = prettierFormat(unformattedText, PRETTIER_OPTIONS);
  const formattedAst = astFromTypescriptFileContent(formattedText);

  const wrapUnwraps: PrettierWrapUnwrap[] = [];
  visitDeepSynced(unformattedAst, formattedAst, (nodeA, nodeB) => {
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
      // TODO
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

  return astFromTypescriptFileContent(adjustedText);
}

export function prettyPrintTsString(unformattedText: string): string {
  const printer = createPrinter();

  const formattedText = prettierFormat(unformattedText, PRETTIER_OPTIONS);

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context) => (rootNode) => {
      function visit(node: ts.Node): ts.Node {
        if (ts.isParenthesizedExpression(node)) {
          return ts.visitEachChild(node.expression, visit, context);
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit);
    };

  const formattedAst = astFromTypescriptFileContent(formattedText);
  const transformResult = ts.transform(formattedAst, [transformer]);
  const astWithoutParens = transformResult.transformed[0];

  const textWithoutParens = printer.printFile(astWithoutParens);
  return textWithoutParens;
}
