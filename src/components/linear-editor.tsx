import { css } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import ts from "typescript";
import { CompilerHost } from "../logic/providers/typescript/compiler-host";
import { prettierFormat } from "../logic/providers/typescript/pretty-print";
import { unreachable } from "../logic/util";

const exampleFile = `
console.log("walrus")
  .test( 
    "bla",
    test,
    1234 + 5,
   );

foo();
if (Date.now() % 100 == 0) {
  console.log("lucky you");
}
`;

type Path = number[];
type EvenPathRange = { anchor: Path; offset: number };
type UnevenPathRange = { anchor: Path; tip: Path };

interface TextRange {
  pos: number;
  end: number;
}

enum NodeKind {
  Token,
  List,
}

type Node = TokenNode | ListNode;

interface TokenNode extends TextRange {
  kind: NodeKind.Token;
  tsNode: ts.Node;
  isPlaceholder?: boolean;
}

enum ListKind {
  TightExpression,
  LooseExpression,
  ParenthesizedExpression,
  CallArguments,
  File,
}

interface ListNode extends TextRange {
  kind: NodeKind.List;
  listKind: ListKind;
  delimiters: [string, string];
  content: Node[];
  equivalentToContent: boolean;
  isPlaceholder?: boolean;
}

const fakeFileName = "file.ts";
const languageVersion = ts.ScriptTarget.ES2020;

function astFromTypescriptFileContent(fileContent: string) {
  const compilerHost = new CompilerHost();
  const file = compilerHost.addFile(fakeFileName, fileContent, languageVersion);
  return file;
}

function isTsBinaryOperatorToken(
  node: ts.Node,
): node is ts.BinaryOperatorToken {
  return (
    ts.isToken(node) &&
    node.kind >= ts.SyntaxKind.FirstBinaryOperator &&
    node.kind <= ts.SyntaxKind.LastBinaryOperator
  );
}

function shouldFlattenWithListKind<K extends ListKind>(
  listKind: K,
  list: Node,
): list is ListNode & { listKind: K } {
  return (
    list.kind === NodeKind.List &&
    list.listKind === listKind &&
    list.equivalentToContent
  );
}

function flattenLeftIfListKind(
  listKind: ListKind,
  left: Node,
  right: Node[],
): Node[] {
  if (shouldFlattenWithListKind(listKind, left)) {
    return [...left.content, ...right];
  }
  return [left, ...right];
}

function flattenIfListKind(listKind: ListKind, node: Node): Node[] {
  return shouldFlattenWithListKind(listKind, node) ? node.content : [node];
}

function listNodeFromTsCallExpression(
  callExpression: ts.CallExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    kind: NodeKind.List,
    listKind: ListKind.TightExpression,
    delimiters: ["", ""],
    content: flattenLeftIfListKind(
      ListKind.TightExpression,
      nodeFromTsNode(callExpression.expression, file),
      [
        listNodeFromDelimitedTsNodeArray(
          callExpression.arguments,
          file,
          ListKind.CallArguments,
          callExpression.arguments.pos - 1,
          callExpression.end,
        ),
      ],
    ),
    equivalentToContent: true,
    pos: callExpression.pos,
    end: callExpression.end,
  };
}

function listNodeFromTsPropertyAccessExpression(
  propertyAccessExpression: ts.PropertyAccessExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    kind: NodeKind.List,
    listKind: ListKind.TightExpression,
    delimiters: ["", ""],
    content: flattenLeftIfListKind(
      ListKind.TightExpression,
      nodeFromTsNode(propertyAccessExpression.expression, file),
      [nodeFromTsNode(propertyAccessExpression.name, file)],
    ),
    equivalentToContent: true,
    pos: propertyAccessExpression.pos,
    end: propertyAccessExpression.end,
  };
}

function listNodeFromTsBinaryExpression(
  binaryExpression: ts.BinaryExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    kind: NodeKind.List,
    listKind: ListKind.LooseExpression,
    delimiters: ["", ""],
    content: [
      ...flattenIfListKind(
        ListKind.LooseExpression,
        nodeFromTsNode(binaryExpression.left, file),
      ),
      nodeFromTsNode(binaryExpression.operatorToken, file),
      ...flattenIfListKind(
        ListKind.LooseExpression,
        nodeFromTsNode(binaryExpression.right, file),
      ),
    ],
    equivalentToContent: true,
    pos: binaryExpression.pos,
    end: binaryExpression.end,
  };
}

function listNodeFromTsParenthesizedExpression(
  parenthesizedExpression: ts.ParenthesizedExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    kind: NodeKind.List,
    listKind: ListKind.ParenthesizedExpression,
    delimiters: ["(", ")"],
    content: [nodeFromTsNode(parenthesizedExpression.expression, file)],
    equivalentToContent: false,
    pos: parenthesizedExpression.pos,
    end: parenthesizedExpression.end,
  };
}

function nodeFromTsNode(node: ts.Node, file: ts.SourceFile | undefined): Node {
  if (ts.isExpressionStatement(node)) {
    return nodeFromTsNode(node.expression, file);
  } else if (ts.isCallExpression(node)) {
    return listNodeFromTsCallExpression(node, file);
  } else if (ts.isPropertyAccessExpression(node)) {
    return listNodeFromTsPropertyAccessExpression(node, file);
  } else if (ts.isBinaryExpression(node)) {
    return listNodeFromTsBinaryExpression(node, file);
  } else if (ts.isParenthesizedExpression(node)) {
    return listNodeFromTsParenthesizedExpression(node, file);
  } else {
    return {
      kind: NodeKind.Token,
      pos: node.pos,
      end: node.end,
      tsNode: node,
    };
  }
}

function listNodeFromDelimitedTsNodeArray(
  nodeArray: ts.NodeArray<ts.Node>,
  file: ts.SourceFile | undefined,
  listKind: ListKind,
  pos: number,
  end: number,
): ListNode {
  if (!file) {
    throw new Error("listNodeFromDelimitedTsNodeArray requires file");
  }

  const validDelimiters = [
    ["(", ")"],
    ["{", "}"],
    ["[", "]"],
  ];
  const delimiters: [string, string] = [file.text[pos], file.text[end - 1]];
  if (
    !validDelimiters.find(
      (d) => d[0] === delimiters[0] && d[1] === delimiters[1],
    )
  ) {
    throw new Error(`invalid delimiters ${JSON.stringify(delimiters)}`);
  }

  return {
    kind: NodeKind.List,
    listKind,
    delimiters,
    content: nodeArray.map((c) => nodeFromTsNode(c, file)),
    equivalentToContent: false,
    pos,
    end,
  };
}

function docFromAst(file: ts.SourceFile): Doc {
  return {
    root: {
      kind: NodeKind.List,
      listKind: ListKind.File,
      delimiters: ["", ""],
      content: file.statements.map((s) => nodeFromTsNode(s, file)),
      equivalentToContent: true,
      pos: file.pos,
      end: file.end,
    },
    text: file.text,
  };
}

interface PathMapping {
  old: Path;
  new: Path;
}

class PathMapper {
  private mappings: PathMapping[] = [];

  constructor(private prefix: Path) {}

  record(m: PathMapping) {
    this.mappings.push(m);
  }

  mapRough(oldExternalPath: Path): Path {
    if (
      !pathsAreEqual(oldExternalPath.slice(0, this.prefix.length), this.prefix)
    ) {
      return oldExternalPath;
    }
    const oldPath = oldExternalPath.slice(this.prefix.length);

    let bestMapping: PathMapping | undefined;
    for (const m of this.mappings) {
      if (
        !bestMapping ||
        getCommonPathPrefix(m.old, oldPath).length >
          getCommonPathPrefix(bestMapping.old, oldPath).length
      ) {
        bestMapping = m;
      }
    }
    if (!bestMapping) {
      return oldExternalPath;
    }
    const common = getCommonPathPrefix(bestMapping.old, oldPath);
    return [
      ...this.prefix,
      ...bestMapping.new.slice(0, common.length),
      ...oldPath.slice(common.length),
    ];
  }
}

function makeNodeValidTs(node: ListNode): {
  node: ListNode;
  pathMapper: PathMapper;
};
function makeNodeValidTs(node: Node): { node: Node; pathMapper: PathMapper };
function makeNodeValidTs(node: Node): { node: Node; pathMapper: PathMapper } {
  const pathMapper = new PathMapper([]);
  return {
    node: _makeNodeValidTs({ node, pathMapper, oldPath: [], newPath: [] }),
    pathMapper,
  };
}

interface OnMapChildArgs {
  node: Node;
  oldIndex: number;
  newIndex: number;
}

function makeLooseExpressionValidTs(
  oldContent: Node[],
  mapChild: (args: OnMapChildArgs) => Node,
): Node[] {
  let wantOperator = false;
  const newContent: Node[] = [];
  const remainingOldContent = [...oldContent];
  while (remainingOldContent.length || !wantOperator) {
    const nextOldNode = remainingOldContent[0];
    const nextIsOperator =
      nextOldNode?.kind === NodeKind.Token &&
      isTsBinaryOperatorToken(nextOldNode.tsNode);
    if (nextOldNode && nextIsOperator === wantOperator) {
      newContent.push(
        mapChild({
          node: nextOldNode,
          oldIndex: oldContent.length - remainingOldContent.length,
          newIndex: newContent.length,
        }),
      );
      remainingOldContent.shift();
    } else {
      const newNode = nodeFromTsNode(
        wantOperator
          ? ts.createToken(ts.SyntaxKind.PlusToken)
          : ts.createIdentifier("placeholder"),
        undefined,
      );
      newNode.isPlaceholder = true;
      newContent.push(newNode);
    }
    wantOperator = !wantOperator;
  }
  return newContent;
}

function _makeNodeValidTs({
  node,
  pathMapper,
  oldPath,
  newPath,
}: {
  node: Node;
  pathMapper: PathMapper;
  oldPath: Path;
  newPath: Path;
}): Node {
  if (!pathsAreEqual(oldPath, newPath)) {
    pathMapper.record({ old: oldPath, new: newPath });
  }
  if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TightExpression &&
    node.content.length > 0 &&
    node.content[0].kind === NodeKind.List &&
    node.content[0].listKind === ListKind.CallArguments
  ) {
    const placeholder = nodeFromTsNode(
      ts.createIdentifier("placeholder"),
      undefined,
    );
    placeholder.isPlaceholder = true;
    // HACK this.insertState.beforePath might be one past the end of the list,
    // this makes sure it gets mapped correctly
    pathMapper.record({
      old: [...oldPath, node.content.length],
      new: [...oldPath, node.content.length + 1],
    });
    node = {
      ...node,
      content: [
        placeholder,
        ...node.content.map((c, i) =>
          _makeNodeValidTs({
            node: c,
            pathMapper,
            oldPath: [...oldPath, i],
            newPath: [...newPath, i + 1],
          }),
        ),
      ],
    };
  } else if (
    node.kind === NodeKind.List &&
    node.content.length === 1 &&
    (node.listKind === ListKind.TightExpression ||
      (node.listKind === ListKind.LooseExpression &&
        (node.content[0].kind !== NodeKind.Token ||
          !isTsBinaryOperatorToken(node.content[0].tsNode))))
  ) {
    node = _makeNodeValidTs({
      node: node.content[0],
      pathMapper,
      oldPath: [...oldPath, 0],
      newPath: [...newPath],
    });
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.LooseExpression
  ) {
    node = {
      ...node,
      content: makeLooseExpressionValidTs(
        node.content,
        ({ node: c, oldIndex, newIndex }) =>
          _makeNodeValidTs({
            node: c,
            pathMapper,
            oldPath: [...oldPath, oldIndex],
            newPath: [...newPath, newIndex],
          }),
      ),
    };
  } else if (node.kind === NodeKind.List) {
    node = {
      ...node,
      content: node.content.map((c, i) =>
        _makeNodeValidTs({
          node: c,
          pathMapper,
          oldPath: [...oldPath, i],
          newPath: [...newPath, i],
        }),
      ),
    };
  }
  return node;
}

function filterNodes(
  node: ListNode,
  shouldKeep: (node: Node) => boolean,
): {
  node: ListNode;
  pathMapper: PathMapper;
};
function filterNodes(
  node: Node,
  shouldKeep: (node: Node) => boolean,
): {
  node: Node;
  pathMapper: PathMapper;
};
function filterNodes(
  node: Node,
  shouldKeep: (node: Node) => boolean,
): {
  node: Node;
  pathMapper: PathMapper;
} {
  const pathMapper = new PathMapper([]);
  return {
    node: _filterNodes({
      node,
      shouldKeep,
      pathMapper,
      oldPath: [],
      newPath: [],
    }),
    pathMapper,
  };
}

function _filterNodes({
  node,
  shouldKeep,
  pathMapper,
  oldPath,
  newPath,
}: {
  node: Node;
  shouldKeep: (node: Node) => boolean;
  pathMapper: PathMapper;
  oldPath: Path;
  newPath: Path;
}): Node {
  if (!shouldKeep(node)) {
    throw new Error("node outside of list can't be removed");
  }
  if (node.kind === NodeKind.List) {
    const stuff = node.content.map((c, i) => ({
      c,
      oldI: i,
      newI: i,
      keep: shouldKeep(c),
    }));
    if (!stuff.every(({ keep }) => keep)) {
      let i = 0;
      for (const entry of stuff) {
        entry.newI = i;
        pathMapper.record({
          old: [...oldPath, entry.oldI],
          new: [...newPath, entry.newI],
        });
        if (entry.keep) {
          i++;
        }
      }
    }
    return {
      ...node,
      content: stuff
        .filter(({ keep }) => keep)
        .map(({ c, oldI, newI }) =>
          _filterNodes({
            node: c,
            shouldKeep,
            pathMapper,
            oldPath: [...oldPath, oldI],
            newPath: [...newPath, newI],
          }),
        ),
    };
  }
  return node;
}

// https://github.com/microsoft/TypeScript/blob/663b19fe4a7c4d4ddaa61aedadd28da06acd27b6/src/compiler/utilities.ts#L3659
// https://github.com/prettier/prettier/blob/30f82c0356ad3c24e56e79c95933988c02555427/src/language-js/utils.js#L1106
const precedenceByBinaryOperator = new Map<ts.SyntaxKind, number>();
for (const [i, ops] of [
  [
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
  ],
  [ts.SyntaxKind.QuestionQuestionToken],
  [ts.SyntaxKind.BarBarToken],
  [ts.SyntaxKind.AmpersandAmpersandToken],
  [ts.SyntaxKind.BarToken],
  [ts.SyntaxKind.CaretToken],
  [ts.SyntaxKind.AmpersandToken],
  [
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ],
  [
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.InstanceOfKeyword,
    ts.SyntaxKind.InKeyword,
    ts.SyntaxKind.AsKeyword,
  ],
  [
    ts.SyntaxKind.LessThanLessThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ],
  [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken],
  [
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
  ],
  [ts.SyntaxKind.AsteriskAsteriskToken],
].entries()) {
  for (const op of ops) {
    precedenceByBinaryOperator.set(op, i);
  }
}

function getBinaryOperatorPrecedence(operator: ts.BinaryOperator) {
  const precedence = precedenceByBinaryOperator.get(operator);
  if (precedence === undefined) {
    throw new Error(
      `unknown operator ${operator} (${ts.SyntaxKind[operator]})`,
    );
  }
  return precedence;
}

function tsNodeFromNode(node: Node): ts.Node {
  if (node.kind === NodeKind.Token) {
    return node.tsNode;
  }
  switch (node.listKind) {
    case ListKind.TightExpression: {
      if (node.content.length === 0) {
        throw new Error("empty TightExpression");
      }
      const lastChild = node.content[node.content.length - 1];
      if (node.content.length === 1) {
        return tsNodeFromNode(lastChild);
      }
      const restNode = { ...node, content: node.content.slice(0, -1) };
      if (
        lastChild.kind === NodeKind.List &&
        lastChild.listKind === ListKind.CallArguments
      ) {
        return ts.createCall(
          tsNodeFromNode(restNode) as ts.Expression,
          undefined,
          lastChild.content.map((c) => tsNodeFromNode(c) as ts.Expression),
        );
      } else if (lastChild.kind === NodeKind.List) {
        throw new Error("child list has unsupported ListKind");
      } else {
        return ts.createPropertyAccess(
          tsNodeFromNode(restNode) as ts.Expression,
          tsNodeFromNode(lastChild) as ts.Identifier,
        );
      }
    }
    case ListKind.LooseExpression: {
      if (node.content.length === 0) {
        throw new Error("empty LooseExpression");
      }
      if (node.content.length === 1) {
        return tsNodeFromNode(node.content[0]);
      }
      const operators = node.content
        .map((c, i) => {
          if (c.kind === NodeKind.Token && isTsBinaryOperatorToken(c.tsNode)) {
            return {
              i,
              tsNode: c.tsNode,
              precedence: getBinaryOperatorPrecedence(c.tsNode.kind),
            };
          }
          return undefined;
        })
        .filter((v) => v)
        .map((v) => v!);
      const minPrecedence = Math.min(...operators.map((o) => o.precedence));
      const rightAssociative =
        minPrecedence ===
        getBinaryOperatorPrecedence(ts.SyntaxKind.AsteriskAsteriskToken);
      const splitAt = (
        rightAssociative ? operators : [...operators].reverse()
      ).find((o) => o.precedence === minPrecedence);
      if (!splitAt) {
        throw new Error("LooseExpression contains no operators");
      }
      return ts.createBinary(
        tsNodeFromNode({
          ...node,
          content: node.content.slice(0, splitAt.i),
        }) as ts.Expression,
        splitAt.tsNode,
        tsNodeFromNode({
          ...node,
          content: node.content.slice(splitAt.i + 1),
        }) as ts.Expression,
      );
    }
    case ListKind.ParenthesizedExpression:
      if (node.content.length !== 1) {
        throw new Error("ParenthesizedExpression must have exactly 1 child");
      }
      return ts.createParen(tsNodeFromNode(node.content[0]) as ts.Expression);
    case ListKind.CallArguments:
      throw new Error(
        "CallArguments should be handled by TightExpression parent",
      );
    case ListKind.File:
      return ts.updateSourceFileNode(
        ts.createSourceFile(fakeFileName, "", languageVersion),
        node.content.map((c) => tsNodeFromNode(c) as ts.Statement),
      );
    default:
      return unreachable(node.listKind);
  }
}

function printTsSourceFile(file: ts.SourceFile): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const unformattedText = printer.printNode(ts.EmitHint.SourceFile, file, file);

  const formattedText = prettierFormat(unformattedText);

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

function nodesAreEqualExceptRangesAndPlaceholders(a: Node, b: Node): boolean {
  if (a.kind === NodeKind.Token && b.kind === NodeKind.Token) {
    // TODO check that the tsNodes have equal content
    return a.tsNode.kind === b.tsNode.kind;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    return (
      a.listKind === b.listKind &&
      a.delimiters[0] === b.delimiters[0] &&
      a.delimiters[1] === b.delimiters[1] &&
      a.content.length === b.content.length &&
      a.content.every((ca, i) =>
        nodesAreEqualExceptRangesAndPlaceholders(ca, b.content[i]),
      ) &&
      a.equivalentToContent === b.equivalentToContent
    );
  }
  return false;
}

function withCopiedPlaceholders(
  placeholderSource: ListNode,
  nodeSource: ListNode,
): ListNode;
function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node;
function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    !nodesAreEqualExceptRangesAndPlaceholders(placeholderSource, nodeSource)
  ) {
    throw new Error(
      "nodes do not satisfy nodesAreEqualExceptRangesAndPlaceholders",
    );
  }
  return _withCopiedPlaceholders(placeholderSource, nodeSource);
}

function _withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    placeholderSource.kind === NodeKind.Token &&
    nodeSource.kind === NodeKind.Token
  ) {
    return { ...nodeSource, isPlaceholder: placeholderSource.isPlaceholder };
  }
  if (
    placeholderSource.kind === NodeKind.List &&
    nodeSource.kind === NodeKind.List
  ) {
    return {
      ...nodeSource,
      isPlaceholder: placeholderSource.isPlaceholder,
      content: placeholderSource.content.map((placeholderSourceChild, i) =>
        _withCopiedPlaceholders(placeholderSourceChild, nodeSource.content[i]),
      ),
    };
  }
  throw new Error("unreachable");
}

interface NodeWithPath {
  node: Node;
  path: Path;
}

function prefixNodesWithPaths(
  nodes: NodeWithPath[],
  prefix: number,
): NodeWithPath[] {
  return nodes.map((r) => ({ ...r, path: [prefix, ...r.path] }));
}

function flattenNode(node: Node): NodeWithPath[] {
  if (node.kind === NodeKind.Token || !node.equivalentToContent) {
    return [{ node, path: [] }];
  }
  return node.content.flatMap((c, i) =>
    prefixNodesWithPaths(flattenNode(c), i),
  );
}

function flattenNodeAroundSplit(
  node: Node,
  splitBeforePath: Path,
): { before: NodeWithPath[]; after: NodeWithPath[] } {
  if (!splitBeforePath.length || node.kind === NodeKind.Token) {
    return { before: [], after: flattenNode(node) };
  }
  const before = node.content
    .slice(0, splitBeforePath[0])
    .flatMap((c, i) => prefixNodesWithPaths(flattenNode(c), i));
  const nodeAt = node.content[splitBeforePath[0]] as Node | undefined;
  const prefixRecursion = ({
    before,
    after,
  }: ReturnType<typeof flattenNodeAroundSplit>) => ({
    before: prefixNodesWithPaths(before, splitBeforePath[0]),
    after: prefixNodesWithPaths(after, splitBeforePath[0]),
  });
  const at =
    nodeAt &&
    prefixRecursion(flattenNodeAroundSplit(nodeAt, splitBeforePath.slice(1)));
  const after = node.content
    .slice(splitBeforePath[0] + 1)
    .flatMap((c, i) =>
      prefixNodesWithPaths(flattenNode(c), splitBeforePath[0] + 1 + i),
    );
  return {
    before: [...before, ...(at?.before || [])],
    after: [...(at?.after || []), ...after],
  };
}

// path must point *inside* the list, not just at it
function getPathToDeepestDelimitedListOrRoot(root: ListNode, path: Path): Path {
  return _getPathToDeepestDelimitedList(root, path) || [];
}

function _getPathToDeepestDelimitedList(
  node: ListNode,
  path: Path,
): Path | undefined {
  if (!path.length) {
    return undefined;
  }

  let deeperPathSuffix: Path | undefined;
  const child = node.content[path[0]];
  if (child?.kind === NodeKind.List) {
    deeperPathSuffix = _getPathToDeepestDelimitedList(child, path.slice(1));
  }

  const pathIfDelimited = node.equivalentToContent ? undefined : [];
  return deeperPathSuffix ? [path[0], ...deeperPathSuffix] : pathIfDelimited;
}

function splitAtDeepestDelimiter(
  root: ListNode,
  targetPath: Path,
): {
  withEmptyList: ListNode;
  list: ListNode;
  pathToList: Path;
  pathFromList: Path;
} {
  const delimitedPath = getPathToDeepestDelimitedListOrRoot(root, targetPath);
  return {
    withEmptyList: nodeMapAtPath(delimitedPath, (node) => {
      if (node.kind !== NodeKind.List) {
        throw new Error("node is not a list");
      }
      return { ...node, content: [] };
    })(root) as ListNode,
    list: nodeGetByPath(root, delimitedPath) as ListNode,
    pathToList: delimitedPath,
    pathFromList: targetPath.slice(delimitedPath.length),
  };
}

type CheckedInsertion =
  | {
      valid: false;
    }
  | {
      valid: true;
      pathMapper: PathMapper;
    };

function checkInsertion(
  nodeOld: ListNode,
  nodeNew: ListNode,
  insertBeforePath: Path,
): CheckedInsertion {
  const printReason = (reason: string) => {
    console.warn(`Insertion is not valid. Reason: ${reason}`);
  };

  if (!insertBeforePath.length) {
    throw new Error("insertBeforePath must not be empty");
  }

  const delimiterSplitOld = splitAtDeepestDelimiter(nodeOld, insertBeforePath);
  const delimiterSplitNew = splitAtDeepestDelimiter(nodeNew, insertBeforePath);
  if (
    !nodesAreEqualExceptRangesAndPlaceholders(
      delimiterSplitOld.withEmptyList,
      delimiterSplitNew.withEmptyList,
    )
  ) {
    printReason("changes outside of nearest containing delimited list");
    return { valid: false };
  }

  if (
    !pathsAreEqual(delimiterSplitOld.pathToList, delimiterSplitNew.pathToList)
  ) {
    printReason("path to nearest containing delimited list has changed");
    return { valid: false };
  }

  const flatOld = flattenNodeAroundSplit(
    delimiterSplitOld.list,
    delimiterSplitOld.pathFromList,
  );
  const flatNew = flattenNodeAroundSplit(
    delimiterSplitNew.list,
    delimiterSplitNew.pathFromList,
  );
  if (
    flatOld.before.length > flatNew.before.length ||
    flatOld.after.length > flatNew.after.length
  ) {
    printReason("new flat lists are shorter");
    return { valid: false };
  }

  const allNodesAreEqualWithoutPaths = (
    nodesA: NodeWithPath[],
    nodesB: NodeWithPath[],
  ): boolean =>
    nodesA.every((a, i) =>
      nodesAreEqualExceptRangesAndPlaceholders(a.node, nodesB[i].node),
    );
  const flatNewBeforeCommon = flatNew.before.slice(0, flatOld.before.length);
  if (!allNodesAreEqualWithoutPaths(flatOld.before, flatNewBeforeCommon)) {
    printReason("existing nodes before cursor changed");
    return { valid: false };
  }
  const flatNewAfterCommon = sliceTail(flatNew.after, flatOld.after.length);
  if (!allNodesAreEqualWithoutPaths(flatOld.after, flatNewAfterCommon)) {
    printReason("existing nodes after cursor changed");
    return { valid: false };
  }

  const pathMapper = new PathMapper(delimiterSplitOld.pathToList);
  for (const [i, oldEntry] of flatOld.before.entries()) {
    pathMapper.record({ old: oldEntry.path, new: flatNewBeforeCommon[i].path });
  }
  for (const [i, oldEntry] of flatOld.after.entries()) {
    pathMapper.record({ old: oldEntry.path, new: flatNewAfterCommon[i].path });
  }

  return { valid: true, pathMapper };
}

function mapNodeTextRanges(
  node: ListNode,
  cb: (pos: number) => number,
): ListNode;
function mapNodeTextRanges(node: Node, cb: (pos: number) => number): Node;
function mapNodeTextRanges(node: Node, cb: (pos: number) => number): Node {
  node = { ...node, pos: cb(node.pos), end: cb(node.end) };
  if (node.kind === NodeKind.List) {
    node.content = node.content.map((c) => mapNodeTextRanges(c, cb));
  }
  return node;
}

function checkTextRangesDoNotOverlap(ranges: TextRange[]): boolean {
  const sortedRanges = [...ranges];
  sortedRanges.sort();
  return ranges.every((r, i) => i === 0 || ranges[i - 1].end <= r.pos);
}

interface Doc {
  root: ListNode;
  text: string;
}

const emptyDoc: Doc = {
  root: {
    kind: NodeKind.List,
    listKind: ListKind.File,
    delimiters: ["", ""],
    content: [],
    equivalentToContent: true,
    pos: 0,
    end: 0,
  },
  text: "",
};

const initialDoc = docFromAst(astFromTypescriptFileContent(exampleFile));

function docMapRoot(doc: Doc, cb: (node: ListNode) => Node): Doc {
  const newRoot = cb(doc.root);
  if (newRoot === doc.root) {
    return doc;
  }
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("newRoot must be a ListNode");
  }
  return { ...doc, root: newRoot };
}

function getDocWithAllPlaceholders(docWithoutPlaceholders: Doc): {
  doc: Doc;
  pathMapper: PathMapper;
} {
  const placeholderAddition = makeNodeValidTs(docWithoutPlaceholders.root);
  const validRoot = placeholderAddition.node;
  const sourceFile = tsNodeFromNode(validRoot) as ts.SourceFile;
  const text = printTsSourceFile(sourceFile);
  const parsedDoc = docFromAst(astFromTypescriptFileContent(text));
  if (!nodesAreEqualExceptRangesAndPlaceholders(validRoot, parsedDoc.root)) {
    console.warn("update would change tree", validRoot, parsedDoc.root);
    throw new Error("update would change tree");
  }
  const docWithPlaceholders = {
    root: withCopiedPlaceholders(validRoot, parsedDoc.root),
    text: parsedDoc.text,
  };
  return {
    doc: docWithPlaceholders,
    pathMapper: placeholderAddition.pathMapper,
  };
}

function getDocWithoutPlaceholdersNearCursor(
  doc: Doc,
  cursorBeforePos: number,
): {
  doc: Doc;
  mapOldToWithoutAdjacent: (path: Path) => Path;
  cursorBeforePos: number;
} {
  const placeholderAddition = getDocWithAllPlaceholders(doc);

  // TODO ignore whitespace
  const isAdjacentToCursor = (range: TextRange) =>
    range.pos === cursorBeforePos || range.end === cursorBeforePos;
  const shouldKeepNode = (node: Node) =>
    !node.isPlaceholder || !isAdjacentToCursor(node);
  const placeholderRemoval = filterNodes(
    placeholderAddition.doc.root,
    shouldKeepNode,
  );
  const removedPlaceholders: Node[] = [];
  nodeVisitDeep(placeholderAddition.doc.root, (node) => {
    if (!shouldKeepNode(node)) {
      removedPlaceholders.push(node);
    }
  });

  const textDeletion = getTextWithDeletions(
    placeholderAddition.doc.text,
    removedPlaceholders,
  );

  const mapOldToWithoutAdjacent = (oldPath: Path) =>
    placeholderRemoval.pathMapper.mapRough(
      placeholderAddition.pathMapper.mapRough(oldPath),
    );

  return {
    doc: {
      root: mapNodeTextRanges(placeholderRemoval.node, textDeletion.mapPos),
      text: textDeletion.text,
    },
    mapOldToWithoutAdjacent,
    cursorBeforePos: textDeletion.mapPos(cursorBeforePos),
  };
}

function getDocWithInsert(
  doc: Doc,
  insertState: Pick<InsertState, "beforePos" | "text">,
): Doc {
  return {
    root: mapNodeTextRanges(doc.root, (pos) =>
      pos >= insertState.beforePos ? pos + insertState.text.length : pos,
    ),
    text:
      doc.text.slice(0, insertState.beforePos) +
      insertState.text +
      doc.text.slice(insertState.beforePos),
  };
}

function getTextWithDeletions(
  text: string,
  _deleteRanges: TextRange[],
): { text: string; mapPos: (pos: number) => number } {
  if (!_deleteRanges.length) {
    return { text, mapPos: (pos) => pos };
  }

  const deleteRanges = [..._deleteRanges];
  deleteRanges.sort();

  if (!checkTextRangesDoNotOverlap(deleteRanges)) {
    throw new Error("deleteRanges overlap");
  }

  return {
    text:
      text.slice(0, deleteRanges[0].pos) +
      deleteRanges.map((r, i) => {
        const nextPos =
          i + 1 === deleteRanges.length ? text.length : deleteRanges[i + 1].pos;
        return text.slice(r.end, nextPos);
      }),

    // Example
    // 0123456789
    //  xxx x
    //    !
    // 046789
    //  !
    mapPos: (pos) => {
      const containingRange = deleteRanges.find(
        (r) => r.pos <= pos && r.end > pos,
      );
      if (containingRange) {
        pos = containingRange.end;
      }
      const rangesBefore = deleteRanges.filter((r) => r.end <= pos);
      const deletedCharsBefore = rangesBefore.reduce(
        (a, c) => a + (c.end - c.pos),
        0,
      );
      return pos - deletedCharsBefore;
    },
  };
}

function asUnevenPathRange(even: EvenPathRange): UnevenPathRange {
  if (!even.offset) {
    return { anchor: even.anchor, tip: even.anchor };
  }
  if (!even.anchor.length) {
    throw new Error("offset at root is invalid");
  }
  const tip = [...even.anchor];
  tip[tip.length - 1] += even.offset;
  return { anchor: even.anchor, tip };
}

function asEvenPathRange(uneven: UnevenPathRange): EvenPathRange {
  const commonPrefix = [];
  let firstUnequal: { anchor: number; tip: number } | undefined;
  for (let i = 0; i < Math.min(uneven.anchor.length, uneven.tip.length); i++) {
    if (uneven.anchor[i] === uneven.tip[i]) {
      commonPrefix.push(uneven.anchor[i]);
    } else {
      firstUnequal = { anchor: uneven.anchor[i], tip: uneven.tip[i] };
      break;
    }
  }
  return firstUnequal
    ? {
        anchor: [...commonPrefix, firstUnequal.anchor],
        offset: firstUnequal.tip - firstUnequal.anchor,
      }
    : { anchor: commonPrefix, offset: 0 };
}

function sliceTail<T>(a: T[], n: number): T[] {
  if (n < 0) {
    throw new Error("negative count");
  }
  if (n === 0) {
    return [];
  }
  return a.slice(-n);
}

function pathsAreEqual(a: Path, b: Path): boolean {
  return a === b || (a.length === b.length && a.every((v, i) => v === b[i]));
}

function getCommonPathPrefix(a: Path, b: Path): Path {
  const common: Path = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      break;
    }
    common.push(a[i]);
  }
  return common;
}

function evenPathRangesAreEqual(a: EvenPathRange, b: EvenPathRange): boolean {
  return (
    a === b || (pathsAreEqual(a.anchor, b.anchor) && a.offset === b.offset)
  );
}

function unevenPathRangesAreEqual(
  a: UnevenPathRange,
  b: UnevenPathRange,
): boolean {
  return (
    a === b ||
    (pathsAreEqual(a.anchor, b.anchor) && pathsAreEqual(a.tip, b.tip))
  );
}

function nodeTryGetDeepestByPath(
  node: Node,
  path: Path,
): { path: Path; node: Node } {
  if (!path.length) {
    return { path: [], node };
  }
  switch (node.kind) {
    case NodeKind.Token:
      return { path: [], node };
    case NodeKind.List: {
      const childNode = node.content[path[0]];
      if (!childNode) {
        return { path: [], node };
      }
      const childResult = nodeTryGetDeepestByPath(childNode, path.slice(1));
      return { node: childResult.node, path: [path[0], ...childResult.path] };
    }
    default:
      return unreachable(node);
  }
}

function nodeGetByPath(node: Node, path: Path): Node | undefined {
  const result = nodeTryGetDeepestByPath(node, path);
  return result.path.length === path.length ? result.node : undefined;
}

function nodeSetByPath(node: Node, path: Path, value: Node): Node {
  if (!path.length) {
    return value;
  }
  switch (node.kind) {
    case NodeKind.Token:
      throw new Error("path too long");
    case NodeKind.List: {
      const targetIndex = path[0];
      const childNode = node.content[targetIndex];
      if (!childNode) {
        throw new Error("missing child");
      }
      const newContent = [...node.content];
      newContent[targetIndex] = nodeSetByPath(childNode, path.slice(1), value);
      if (newContent[targetIndex] === node.content[targetIndex]) {
        return node;
      }
      return { ...node, content: newContent };
    }
    default:
      return unreachable(node);
  }
}

function nodeMapAtPath(
  path: Path,
  cb: (node: Node) => Node,
): (node: Node) => Node {
  return (node) => {
    const oldFocusedNode = nodeGetByPath(node, path);
    if (!oldFocusedNode) {
      throw new Error("node at path does not exist");
    }
    return nodeSetByPath(node, path, cb(oldFocusedNode));
  };
}

function nodeVisitDeep(
  node: Node,
  cb: (node: Node, path: Path) => void,
  path: Path = [],
) {
  cb(node, path);
  if (node.kind === NodeKind.List) {
    for (const [i, c] of node.content.entries()) {
      nodeVisitDeep(c, cb, [...path, i]);
    }
  }
}

function flipEvenPathRange(oldPathRange: EvenPathRange): EvenPathRange {
  if (!oldPathRange.anchor.length || !oldPathRange.offset) {
    return oldPathRange;
  }
  const newPathRange = {
    anchor: [...oldPathRange.anchor],
    offset: -oldPathRange.offset,
  };
  newPathRange.anchor[newPathRange.anchor.length - 1] += oldPathRange.offset;
  return newPathRange;
}

function flipUnevenPathRange({
  anchor,
  tip,
}: UnevenPathRange): UnevenPathRange {
  return { anchor: tip, tip: anchor };
}

function getPathToTip(pathRange: EvenPathRange): Path {
  const path = [...pathRange.anchor];
  if (!path.length) {
    return [];
  }
  path[path.length - 1] += pathRange.offset;
  return path;
}

function withoutInvisibleNodes(
  doc: Doc,
  focus: EvenPathRange,
): { doc: Doc; focus: EvenPathRange } {
  if (focus.offset < 0) {
    const result = withoutInvisibleNodes(doc, flipEvenPathRange(focus));
    return { doc: result.doc, focus: flipEvenPathRange(result.focus) };
  }
  const result = _withoutInvisibleNodes(doc.root, focus);
  return {
    doc: result ? docMapRoot(doc, () => result.node) : emptyDoc,
    focus: result?.focus || { anchor: [], offset: 0 },
  };
}

function _withoutInvisibleNodes(
  node: Node,
  focus: EvenPathRange | undefined,
): { node: Node; focus: EvenPathRange | undefined } | undefined {
  if (node.kind === NodeKind.Token) {
    return { node, focus };
  }
  if (node.kind === NodeKind.List) {
    if (!node.content.length) {
      if (node.equivalentToContent) {
        return undefined;
      }
      return { node, focus };
    }

    let focusedChildIndex: number | undefined;
    let directlyFocusedChildRange: [number, number] | undefined;
    if (focus?.anchor.length === 1) {
      directlyFocusedChildRange = [
        focus.anchor[0],
        focus.anchor[0] + focus.offset,
      ];
      if (directlyFocusedChildRange[0] > directlyFocusedChildRange[1]) {
        directlyFocusedChildRange = [
          directlyFocusedChildRange[1],
          directlyFocusedChildRange[0],
        ];
      }
    } else if (focus && focus.anchor.length > 1) {
      focusedChildIndex = focus.anchor[0];
    }

    const results = node.content.map((c, i) =>
      _withoutInvisibleNodes(
        c,
        focusedChildIndex === i
          ? { anchor: focus!.anchor.slice(1), offset: focus!.offset }
          : directlyFocusedChildRange &&
            i >= directlyFocusedChildRange[0] &&
            i <= directlyFocusedChildRange[1]
          ? { anchor: [], offset: 0 }
          : undefined,
      ),
    );
    const filteredOldIndices = results
      .map((r, i) => [r, i] as const)
      .filter(([r, _i]) => r)
      .map(([_r, i]) => i);
    const newNode = {
      ...node,
      content: results
        .map((r) => r?.node)
        .filter((v) => v)
        .map((v) => v!),
    };

    if (!newNode.content.length && node.equivalentToContent) {
      return undefined;
    }
    if (!focus) {
      return { node: newNode, focus: undefined };
    }
    if (!newNode.content.length) {
      return { node: newNode, focus: { anchor: [], offset: 0 } };
    }
    if (directlyFocusedChildRange && results.some((r) => r?.focus)) {
      const remainingResults = results.filter((r) => r);
      const firstIndex = remainingResults.findIndex((r) => r?.focus);
      let lastIndex = firstIndex;
      for (let i = firstIndex; i < remainingResults.length; i++) {
        if (remainingResults[i]?.focus) {
          lastIndex = i;
        }
      }
      return {
        node: newNode,
        focus: { anchor: [firstIndex], offset: lastIndex - firstIndex },
      };
    }
    if (focusedChildIndex !== undefined) {
      const childFocus = results[focusedChildIndex]?.focus;
      if (childFocus) {
        const newFocusedChildIndex =
          filteredOldIndices.indexOf(focusedChildIndex);
        return {
          node: newNode,
          focus: {
            anchor: [newFocusedChildIndex, ...childFocus.anchor],
            offset: childFocus.offset,
          },
        };
      } else {
        const minIndexAfterFocused = filteredOldIndices.findIndex(
          (i) => i > focusedChildIndex!,
        );
        const maxIndexBeforeFocused = Math.max(
          ...filteredOldIndices.filter((i) => i < focusedChildIndex!),
          -1,
        );
        const newFocusedChildIndex =
          minIndexAfterFocused >= 0
            ? minIndexAfterFocused
            : maxIndexBeforeFocused;
        return {
          node: newNode,
          focus: { anchor: [newFocusedChildIndex], offset: 0 },
        };
      }
    }
    if (!directlyFocusedChildRange) {
      return { node: newNode, focus: focus };
    }
    {
      const minIndexAfterFocused = filteredOldIndices.findIndex(
        (i) => i > directlyFocusedChildRange![1],
      );
      const maxIndexBeforeFocused = Math.max(
        ...filteredOldIndices.filter((i) => i < directlyFocusedChildRange![1]),
        -1,
      );
      const newFocusedChildIndex =
        minIndexAfterFocused >= 0
          ? minIndexAfterFocused
          : maxIndexBeforeFocused;
      return {
        node: newNode,
        focus: { anchor: [newFocusedChildIndex], offset: 0 },
      };
    }
  }
}

enum Mode {
  Normal,
  InsertBefore,
  InsertAfter,
}

interface InsertState {
  beforePos: number;
  beforePath: Path;
  text: string;
}

class DocManager {
  private doc: Doc = initialDoc;
  private focus: UnevenPathRange = { anchor: [], tip: [] };
  private parentFocuses: EvenPathRange[] = [];
  private history: {
    doc: Doc;
    focus: UnevenPathRange;
    parentFocuses: EvenPathRange[];
    insertState: InsertState;
  }[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private insertState: InsertState | undefined;

  constructor(
    private _onUpdate: (stuff: {
      doc: Doc;
      focus: EvenPathRange;
      mode: Mode;
    }) => void,
  ) {}

  forceUpdate() {
    if (this.mode !== Mode.Normal) {
      throw new Error("forceUpdate can only be called in normal mode");
    }
    this.onUpdate();
    this.history = [];
  }

  onKeyPress = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter") {
        const evenFocus = asEvenPathRange(this.focus);
        if (evenFocus.offset !== 0) {
          return;
        }
        const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
        if (focusedNode?.kind !== NodeKind.List || focusedNode.content.length) {
          return;
        }
        this.insertState = {
          beforePos: focusedNode.pos + focusedNode.delimiters[0].length,
          beforePath: [...evenFocus.anchor, 0],
          text: "",
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "i") {
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const firstFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);

        const firstFocusedNode = nodeGetByPath(this.doc.root, firstFocusedPath);
        if (!firstFocusedNode) {
          throw new Error("invalid focus");
        }
        this.insertState = {
          beforePos: firstFocusedNode.pos,
          beforePath: firstFocusedPath,
          text: "",
        };
        this.mode = Mode.InsertBefore;
      } else if (ev.key === "a") {
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset > 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const lastFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);

        const lastFocusedNode = nodeGetByPath(this.doc.root, lastFocusedPath);
        if (!lastFocusedNode) {
          throw new Error("invalid focus");
        }
        this.insertState = {
          beforePos: lastFocusedNode.end,
          beforePath: [
            ...lastFocusedPath.slice(0, -1),
            lastFocusedPath[lastFocusedPath.length - 1] + 1,
          ],
          text: "",
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "d") {
        const evenFocus = asEvenPathRange(this.focus);
        let forwardFocus =
          evenFocus.offset < 0 ? flipEvenPathRange(evenFocus) : evenFocus;
        if (evenFocus.anchor.length === 0) {
          if (!this.doc.root.content.length) {
            return;
          }
          forwardFocus = {
            anchor: [0],
            offset: this.doc.root.content.length - 1,
          };
        }
        let newFocusIndex: number | undefined;
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(forwardFocus.anchor.slice(0, -1), (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const newContent = [...oldListNode.content];
            const deleteFrom =
              forwardFocus.anchor[forwardFocus.anchor.length - 1];
            const deleteCount = forwardFocus.offset + 1;
            if (deleteFrom + deleteCount < oldListNode.content.length) {
              newFocusIndex = deleteFrom;
            } else if (deleteFrom > 0) {
              newFocusIndex = deleteFrom - 1;
            }
            newContent.splice(deleteFrom, deleteCount);
            return { ...oldListNode, content: newContent };
          }),
        );
        this.focus = asUnevenPathRange({
          anchor:
            newFocusIndex === undefined
              ? forwardFocus.anchor.slice(0, -1)
              : [...forwardFocus.anchor.slice(0, -1), newFocusIndex],
          offset: 0,
        });
      } else if (ev.key === "l") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, false));
      } else if (ev.key === "L") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, true));
      } else if (ev.key === "h") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, false));
      } else if (ev.key === "H") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, true));
      } else if (ev.key === "k") {
        this.tryMoveOutOfList();
      } else if (ev.key === "K") {
        this.tryMoveToParent();
      } else if (ev.key === "j") {
        this.tryMoveIntoList();
      } else if (ev.key === ";") {
        this.focus = asUnevenPathRange({
          anchor: getPathToTip(asEvenPathRange(this.focus)),
          offset: 0,
        });
      }
    } else if (
      this.mode === Mode.InsertBefore ||
      this.mode === Mode.InsertAfter
    ) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (ev.key.length === 1) {
        ev.preventDefault();
        this.insertState = {
          ...this.insertState,
          text: this.insertState.text + ev.key,
        };
      }
    }

    this.onUpdate();
  };

  onKeyDown = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal && ev.key === ";" && ev.altKey) {
      this.focus = flipUnevenPathRange(this.focus);
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }

      if (this.history.length > 1) {
        // TODO remove placeholders next to cursor during insert
        try {
          const initialPlaceholderInsertion =
            getDocWithoutPlaceholdersNearCursor(
              this.doc,
              this.insertState.beforePos,
            );

          const docWithInsert = docFromAst(
            astFromTypescriptFileContent(
              printTsSourceFile(
                astFromTypescriptFileContent(
                  getDocWithInsert(initialPlaceholderInsertion.doc, {
                    text: this.insertState.text,
                    beforePos: initialPlaceholderInsertion.cursorBeforePos,
                  }).text,
                ),
              ),
            ),
          );

          const checkedInsertion = checkInsertion(
            initialPlaceholderInsertion.doc.root,
            docWithInsert.root,
            initialPlaceholderInsertion.mapOldToWithoutAdjacent(
              this.insertState.beforePath,
            ),
          );
          if (!checkedInsertion.valid) {
            throw new Error("checkedInsertion is not valid");
          }

          nodeVisitDeep(
            initialPlaceholderInsertion.doc.root,
            (oldNode, oldPath) => {
              if (!oldNode.isPlaceholder) {
                return;
              }
              const newNode = nodeGetByPath(
                docWithInsert.root,
                checkedInsertion.pathMapper.mapRough(oldPath),
              );
              if (!newNode) {
                throw new Error("placeholder not found in new tree");
              }
              // HACK mutating docWithInsert
              newNode.isPlaceholder = true;
            },
          );

          const placeholderRemoval = filterNodes(
            docWithInsert.root,
            (node) => !node.isPlaceholder,
          );

          this.doc = { ...docWithInsert, root: placeholderRemoval.node };
          const mapPath = (p: Path) =>
            placeholderRemoval.pathMapper.mapRough(
              checkedInsertion.pathMapper.mapRough(
                initialPlaceholderInsertion.mapOldToWithoutAdjacent(p),
              ),
            );
          this.focus = {
            anchor: mapPath(this.focus.anchor),
            tip: mapPath(this.focus.tip),
          };
        } catch (err) {
          console.warn("insertion would make doc invalid", err);
          return;
        }
      }

      this.mode = Mode.Normal;
      this.history = [];
      this.parentFocuses = [];
      this.insertState = undefined;
      this.removeInvisibleNodes();
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Backspace"
    ) {
      if (this.history.length < 2) {
        return;
      }
      this.history.pop();
      const old = this.history.pop()!;
      this.doc = old.doc;
      this.focus = old.focus;
      this.parentFocuses = old.parentFocuses;
      this.insertState = old.insertState;
      this.onUpdate();
    }
  };

  onKeyUp = (ev: KeyboardEvent) => {
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  private tryMoveOutOfList() {
    let evenFocus = asEvenPathRange(this.focus);
    while (evenFocus.anchor.length >= 2) {
      evenFocus = {
        anchor: evenFocus.anchor.slice(0, -1),
        offset: 0,
      };
      const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
      if (
        focusedNode?.kind === NodeKind.List &&
        !focusedNode.equivalentToContent
      ) {
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }
    }
  }

  private tryMoveIntoList() {
    const evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset !== 0) {
      return;
    }
    const listPath = evenFocus.anchor;
    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
      return;
    }
    this.focus = asUnevenPathRange({
      anchor: [...listPath, 0],
      offset: listNode.content.length - 1,
    });
  }

  private tryMoveToParent() {
    let evenFocus = asEvenPathRange(this.focus);
    while (evenFocus.anchor.length) {
      const parentPath = evenFocus.anchor.slice(0, -1);
      const parentNode = nodeGetByPath(this.doc.root, parentPath);
      if (parentNode?.kind !== NodeKind.List) {
        throw new Error("parentNode is not a list");
      }

      const wholeParentSelected =
        Math.abs(evenFocus.offset) + 1 === parentNode.content.length;
      if (!wholeParentSelected) {
        evenFocus = {
          anchor: [...parentPath, 0],
          offset: parentNode.content.length - 1,
        };
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }

      evenFocus = {
        anchor: parentPath,
        offset: 0,
      };
    }

    this.focus = asUnevenPathRange(evenFocus);
    return;
  }

  private tryMoveThroughLeaves(offset: -1 | 1, extend: boolean) {
    let currentPath = [...this.focus.tip];
    while (true) {
      if (!currentPath.length) {
        return;
      }
      const siblingPath = [...currentPath];
      siblingPath[siblingPath.length - 1] += offset;
      if (nodeGetByPath(this.doc.root, siblingPath)) {
        currentPath = siblingPath;
        break;
      }
      currentPath.pop();
    }

    while (true) {
      const currentNode = nodeGetByPath(this.doc.root, currentPath)!;
      if (currentNode.kind !== NodeKind.List || !currentNode.content.length) {
        break;
      }
      const childPath = [
        ...currentPath,
        offset === -1 ? currentNode.content.length - 1 : 0,
      ];
      if (!nodeGetByPath(this.doc.root, childPath)) {
        break;
      }
      currentPath = childPath;
    }

    this.focus = extend
      ? { anchor: this.focus.anchor, tip: currentPath }
      : { anchor: currentPath, tip: currentPath };
  }

  private whileUnevenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (unevenPathRangesAreEqual(this.focus, oldFocus)) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private untilEvenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (unevenPathRangesAreEqual(this.focus, oldFocus)) {
        // avoid infinite loop (if the uneven focus didn't change, it probably never will, so the even focus wont either)
        return;
      }
      if (
        !evenPathRangesAreEqual(
          asEvenPathRange(this.focus),
          asEvenPathRange(oldFocus),
        )
      ) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private onUpdate() {
    if (this.mode === Mode.Normal) {
      this.removeInvisibleNodes();
    }
    this.whileUnevenFocusChanges(() => this.normalizeFocus());
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.history = [];
      }
      this.history.push({
        doc: this.doc,
        focus: this.focus,
        parentFocuses: [...this.parentFocuses],
        insertState: this.insertState,
      });
    }
    this.lastMode = this.mode;

    this.updateDocText();

    this.reportUpdate();
  }

  private reportUpdate() {
    let doc = this.doc;
    if (this.insertState) {
      const result = getDocWithoutPlaceholdersNearCursor(
        this.doc,
        this.insertState.beforePos,
      );
      doc = getDocWithInsert(result.doc, {
        beforePos: result.cursorBeforePos,
        text: this.insertState.text,
      });
      doc = {
        ...doc,
        root: filterNodes(doc.root, (node) => !node.isPlaceholder).node,
      };
    }
    this._onUpdate({
      doc,
      focus: asEvenPathRange(this.focus),
      mode: this.mode,
    });
  }

  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
    this.doc = {
      ...this.doc,
      root: filterNodes(this.doc.root, (node) => !node.isPlaceholder).node,
    };
    // HACK makeNodeValidTs makes replaces some single item lists by their only item.
    // This is the easiest way to make the focus valid again, even though it's not very clean.
    this.fixFocus();
  }

  private fixFocus() {
    this.focus = {
      anchor: nodeTryGetDeepestByPath(this.doc.root, this.focus.anchor).path,
      tip: nodeTryGetDeepestByPath(this.doc.root, this.focus.tip).path,
    };
  }

  private normalizeFocus() {
    const evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset !== 0) {
      return;
    }
    const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
    if (!focusedNode) {
      throw new Error("invalid focus");
    }
    if (
      focusedNode.kind !== NodeKind.List ||
      !focusedNode.equivalentToContent ||
      !focusedNode.content.length
    ) {
      return;
    }
    this.focus = {
      anchor: [...evenFocus.anchor, 0],
      tip: [...evenFocus.anchor, focusedNode.content.length - 1],
    };
  }

  private removeInvisibleNodes() {
    const anchorResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.anchor,
      offset: 0,
    });
    const tipResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.tip,
      offset: 0,
    });
    this.doc = anchorResult.doc;
    this.focus = {
      anchor: anchorResult.focus.anchor,
      tip: tipResult.focus.anchor,
    };
  }
}

const styles = {
  doc: css`
    margin: 5px;
  `,
  modeLine: css`
    margin: 5px;
    margin-top: 15px;
  `,
};

enum CharSelection {
  None = 0,
  Normal = 1,
  Tip = 2,
}

function setCharSelections({
  selectionsByChar,
  node,
  focus,
  isTipOfFocus,
}: {
  selectionsByChar: Uint8Array;
  node: Node;
  focus: EvenPathRange | undefined;
  isTipOfFocus: boolean;
}) {
  const focused = focus !== undefined && focus.anchor.length === 0;
  let focusedChildRange: [number, number] | undefined;
  let tipOfFocusIndex: number | undefined;
  if (focus?.anchor.length) {
    const offset = focus.anchor.length === 1 ? focus.offset : 0;
    focusedChildRange = [focus.anchor[0], focus.anchor[0] + offset];
    if (focus.anchor.length === 1) {
      tipOfFocusIndex = focusedChildRange[1];
    }
    if (focusedChildRange[0] > focusedChildRange[1]) {
      focusedChildRange = [focusedChildRange[1], focusedChildRange[0]];
    }
  }

  if (focused) {
    selectionsByChar.fill(
      isTipOfFocus ? CharSelection.Tip : CharSelection.Normal,
      node.pos,
      node.end,
    );
  }

  if (node.kind === NodeKind.List) {
    for (const [i, c] of node.content.entries()) {
      setCharSelections({
        selectionsByChar,
        node: c,
        focus:
          focusedChildRange &&
          i >= focusedChildRange[0] &&
          i <= focusedChildRange[1]
            ? {
                anchor: focus!.anchor.slice(1),
                offset: focus!.offset,
              }
            : undefined,
        isTipOfFocus: i === tipOfFocusIndex,
      });
    }
  }
}

interface DocRenderLine {
  regions: DocRenderRegion[];
}

interface DocRenderRegion {
  text: string;
  selection: CharSelection;
}

function splitDocRenderRegions(
  text: string,
  selectionsByChar: Uint8Array,
): DocRenderRegion[] {
  if (text.length !== selectionsByChar.length) {
    throw new Error("text and selectionsByChar must have same length");
  }

  if (!selectionsByChar.length) {
    return [];
  }

  const regions: DocRenderRegion[] = [];
  let start = 0;
  const pushRegion = (end: number) => {
    regions.push({
      text: text.slice(start, end),
      selection: selectionsByChar[start],
    });
    start = end;
  };
  for (const [i, selection] of selectionsByChar.entries()) {
    if (selection !== selectionsByChar[start]) {
      pushRegion(i);
    }
    if (i + 1 === selectionsByChar.length) {
      pushRegion(i + 1);
    }
  }
  return regions;
}

function renderDoc(doc: Doc, focus: EvenPathRange): React.ReactNode {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelections({
    selectionsByChar,
    node: doc.root,
    focus,
    isTipOfFocus: false,
  });

  const lines: DocRenderLine[] = [];
  let pos = 0;
  for (const lineText of doc.text.split("\n")) {
    const line = {
      regions: splitDocRenderRegions(
        lineText,
        selectionsByChar.subarray(pos, pos + lineText.length),
      ),
    };
    if (line.regions.length || lines.length) {
      lines.push(line);
    }
    pos += lineText.length + 1;
  }
  while (lines.length && !lines[lines.length - 1].regions.length) {
    lines.pop();
  }

  const backgroundsBySelection: { [K in CharSelection]: string | undefined } = {
    [CharSelection.None]: undefined,
    [CharSelection.Normal]: "rgba(11, 83, 255, 0.15)",
    [CharSelection.Tip]: "rgba(11, 83, 255, 0.37)",
  };

  return (
    <div style={{ whiteSpace: "pre" }}>
      {lines.map((line, iLine) => (
        <div key={iLine}>
          {!line.regions.length && <br />}
          {line.regions.map((region, iRegion) => (
            <span
              key={iRegion}
              style={{ background: backgroundsBySelection[region.selection] }}
            >
              {region.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export const LinearEditor = () => {
  const [{ doc, focus, mode }, setStuff] = useState<{
    doc: Doc;
    focus: EvenPathRange;
    mode: Mode;
  }>({
    doc: emptyDoc,
    focus: { anchor: [], offset: 0 },
    mode: Mode.Normal,
  });
  const [docManager, setDocManager] = useState(new DocManager(setStuff));
  useEffect(() => {
    setDocManager((oldDocManager) => {
      const newDocManager = new DocManager(setStuff);
      (newDocManager as any).doc = (oldDocManager as any).doc;
      (newDocManager as any).history = (oldDocManager as any).history;
      return newDocManager;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DocManager]);
  useEffect(() => {
    docManager.forceUpdate();
  }, [docManager]);

  useEffect(() => {
    const options: EventListenerOptions = { capture: true };
    document.addEventListener("keypress", docManager.onKeyPress, options);
    document.addEventListener("keydown", docManager.onKeyDown, options);
    document.addEventListener("keyup", docManager.onKeyUp, options);
    return () => {
      document.removeEventListener("keypress", docManager.onKeyPress, options);
      document.removeEventListener("keydown", docManager.onKeyDown, options);
      document.removeEventListener("keyup", docManager.onKeyUp, options);
    };
  }, [docManager]);

  return (
    <div>
      <div className={styles.doc}>{renderDoc(doc, focus)}</div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      <pre>
        {JSON.stringify(
          {
            focus,
            tip: nodeGetByPath(doc.root, flipEvenPathRange(focus).anchor),
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
};
