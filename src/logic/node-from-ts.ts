import ts from "typescript";
import { Doc, ListKind, ListNode, Node, NodeKind } from "./interfaces";

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

function listNodeFromDelimitedTsNodeArray(
  nodeArray: ts.NodeArray<ts.Node> | ts.Node[],
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
    ["<", ">"],
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

function listNodeFromNonDelimitedTsNodeArray(
  nodeArray: ts.NodeArray<ts.Node>,
  file: ts.SourceFile | undefined,
  listKind: ListKind,
): ListNode {
  if (!file) {
    throw new Error("listNodeFromDelimitedTsNodeArray requires file");
  }
  if (!nodeArray.length) {
    throw new Error("nodeArray must not be empty");
  }

  return {
    kind: NodeKind.List,
    listKind,
    delimiters: ["", ""],
    content: nodeArray.map((c) => nodeFromTsNode(c, file)),
    equivalentToContent: true,
    pos: nodeArray[0].pos,
    end: nodeArray[nodeArray.length - 1].end,
  };
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
        ...(callExpression.questionDotToken
          ? [nodeFromTsNode(callExpression.questionDotToken, file)]
          : []),
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
      [
        ...(propertyAccessExpression.questionDotToken
          ? [nodeFromTsNode(propertyAccessExpression.questionDotToken, file)]
          : []),
        nodeFromTsNode(propertyAccessExpression.name, file),
      ],
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

function listNodeFromTsArrowFunction(
  arrowFunction: ts.ArrowFunction,
  file: ts.SourceFile | undefined,
): ListNode {
  const structKeys: string[] = [];
  const content: Node[] = [];

  if (arrowFunction.modifiers?.length) {
    structKeys.push("modifiers");
    content.push(
      listNodeFromNonDelimitedTsNodeArray(
        arrowFunction.modifiers,
        file,
        ListKind.UnknownTsNodeArray,
      ),
    );
  }

  if (arrowFunction.typeParameters?.length) {
    structKeys.push("typeParameters");
    content.push(
      listNodeFromDelimitedTsNodeArray(
        arrowFunction.typeParameters,
        file,
        ListKind.UnknownTsNodeArray,
        arrowFunction.typeParameters.pos - 1,
        arrowFunction.typeParameters.end + 1,
      ),
    );
  }

  structKeys.push("parameters");
  content.push(
    listNodeFromDelimitedTsNodeArray(
      arrowFunction.parameters,
      file,
      ListKind.UnknownTsNodeArray,
      arrowFunction.parameters.pos - 1,
      arrowFunction.parameters.end + 1,
    ),
  );

  structKeys.push("equalsGreaterThanToken");
  content.push(nodeFromTsNode(arrowFunction.equalsGreaterThanToken, file));

  structKeys.push("body");
  content.push(nodeFromTsNode(arrowFunction.body, file));

  return {
    kind: NodeKind.List,
    listKind: ListKind.TsNodeStruct,
    tsSyntaxKind: ts.SyntaxKind.ArrowFunction,
    delimiters: ["", ""],
    structKeys,
    content,
    equivalentToContent: true,
    pos: arrowFunction.pos,
    end: arrowFunction.end,
  };
}

function listNodeFromTsIfStatementBranch(
  ifStatement: ts.IfStatement,
  file: ts.SourceFile | undefined,
): ListNode {
  const ifToken = ifStatement.getFirstToken(file);
  if (!ifToken) {
    throw new Error("could not get first token of if statement");
  }
  return {
    kind: NodeKind.List,
    listKind: ListKind.IfBranch,
    delimiters: ["", ""],
    structKeys: ["ifToken", "expression", "statement"],
    content: [
      nodeFromTsNode(ifToken, file),
      listNodeFromDelimitedTsNodeArray(
        [ifStatement.expression],
        file,
        ListKind.UnknownTsNodeArray,
        ifStatement.expression.pos - 1,
        ifStatement.expression.end + 1,
      ),
      nodeFromTsNode(ifStatement.thenStatement, file),
    ],
    equivalentToContent: true,
    pos: ifStatement.pos,
    end: ifStatement.end,
  };
}

function listNodeFromTsIfStatement(
  ifStatement: ts.IfStatement,
  file: ts.SourceFile | undefined,
): ListNode {
  const wrapBranch = (node: Node): Node => {
    if (node.kind === NodeKind.List && node.listKind === ListKind.IfBranch) {
      return node;
    }
    return {
      kind: NodeKind.List,
      listKind: ListKind.IfBranch,
      delimiters: ["", ""],
      structKeys: ["statement"],
      content: [node],
      equivalentToContent: true,
      pos: node.pos,
      end: node.end,
    };
  };
  return {
    kind: NodeKind.List,
    listKind: ListKind.IfBranches,
    delimiters: ["", ""],
    content: [
      listNodeFromTsIfStatementBranch(ifStatement, file),
      ...(ifStatement.elseStatement
        ? flattenIfListKind(
            ListKind.IfBranches,
            nodeFromTsNode(ifStatement.elseStatement, file),
          )
        : []),
    ].map(wrapBranch),
    equivalentToContent: true,
    pos: ifStatement.pos,
    end: ifStatement.end,
  };
}

function listNodeFromTsBlock(
  block: ts.Block,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    ...listNodeFromDelimitedTsNodeArray(
      block.statements,
      file,
      ListKind.TsNodeList,
      block.pos + 1,
      block.end,
    ),
    tsSyntaxKind: ts.SyntaxKind.Block,
  };
}

export function nodeFromTsNode(
  node: ts.Node,
  file: ts.SourceFile | undefined,
): Node {
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
  } else if (ts.isArrowFunction(node)) {
    return listNodeFromTsArrowFunction(node, file);
  } else if (ts.isIfStatement(node)) {
    return listNodeFromTsIfStatement(node, file);
  } else if (ts.isBlock(node)) {
    return listNodeFromTsBlock(node, file);
  } else {
    return {
      kind: NodeKind.Token,
      pos: node.pos,
      end: node.end,
      tsNode: node,
    };
  }
}

export function docFromAst(file: ts.SourceFile): Doc {
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
