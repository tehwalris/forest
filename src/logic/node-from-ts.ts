import ts, { TextRange } from "typescript";
import {
  allowedGenericNodeMatchers,
  UnknownStructTemplate,
} from "./generic-node";
import { Doc, ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { structTemplates } from "./legacy-templates/templates";
import { mapNodeTextRanges } from "./text";
import { isTsVarLetConst } from "./ts-type-predicates";

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

function listNodeFromAutoTsNodeArray(
  nodeArray: ts.NodeArray<ts.Node>,
  parent: ts.Node,
  file: ts.SourceFile | undefined,
  listKind: ListKind,
): ListNode {
  if (!file) {
    throw new Error("listNodeFromAutoTsNodeArray requires file");
  }

  const childrenOfParent = parent.getChildren(file);
  // HACK The relevant child (nodeArray) returned by parent.getChildren() is not
  // reference equal to nodeArray which is passed as our argument. Use text
  // ranges to find this child instead.
  const childIndex = childrenOfParent.findIndex(
    (c) => c.pos === nodeArray.pos && c.end === nodeArray.end,
  );
  if (childIndex === -1) {
    throw new Error("nodeArray not found in parent.getChildren()");
  }

  const delimitedRange: TextRange = { pos: nodeArray.pos, end: nodeArray.end };
  let isDelimited = false;
  if (
    (!nodeArray.length &&
      file.text.slice(nodeArray.pos, nodeArray.end).trim()) ||
    (nodeArray.length &&
      file.text.slice(nodeArray.pos, nodeArray[0].pos).trim())
  ) {
    isDelimited = true;
  } else if (childIndex > 0 && childIndex + 1 < childrenOfParent.length) {
    const surroundingChildren = [
      childrenOfParent[childIndex - 1],
      childrenOfParent[childIndex + 1],
    ] as const;
    const allowedDelimiters: [ts.SyntaxKind, ts.SyntaxKind][] = [
      [ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.CloseParenToken],
      [ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken],
      [ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.CloseBracketToken],
      [ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken],
    ];
    if (
      allowedDelimiters.some(
        (d) =>
          d[0] === surroundingChildren[0].kind &&
          d[1] === surroundingChildren[1].kind,
      )
    ) {
      isDelimited = true;
      delimitedRange.pos = surroundingChildren[0].pos;
      delimitedRange.end = surroundingChildren[1].end;
    }
  }

  if (isDelimited) {
    return listNodeFromDelimitedTsNodeArray(
      nodeArray,
      file,
      listKind,
      delimitedRange.pos,
      delimitedRange.end,
    );
  } else {
    return listNodeFromNonDelimitedTsNodeArray(nodeArray, file, listKind);
  }
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

  // HACK sometimes there's whitespace before the delimiters
  while (pos < file.text.length && file.text[pos].match(/\s/)) {
    pos += 1;
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
        listNodeFromAutoTsNodeArray(
          callExpression.arguments,
          callExpression,
          file,
          ListKind.CallArguments,
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

function listNodeFromTsNonNullExpression(
  nonNullExpression: ts.NonNullExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  const exclamationToken = nonNullExpression.getLastToken(file);
  if (exclamationToken?.kind !== ts.SyntaxKind.ExclamationToken) {
    throw new Error("could not get exclamationToken from nonNullExpression");
  }
  return {
    kind: NodeKind.List,
    listKind: ListKind.TightExpression,
    delimiters: ["", ""],
    content: flattenLeftIfListKind(
      ListKind.TightExpression,
      nodeFromTsNode(nonNullExpression.expression, file),
      [nodeFromTsNode(exclamationToken, file)],
    ),
    equivalentToContent: true,
    pos: nonNullExpression.pos,
    end: nonNullExpression.end,
  };
}

function listNodeFromTsPostfixUnaryExpression(
  postfixUnaryExpression: ts.PostfixUnaryExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  const operatorToken = postfixUnaryExpression.getLastToken(file);
  if (operatorToken?.kind !== postfixUnaryExpression.operator) {
    throw new Error("could not get operatorToken from postfixUnaryExpression");
  }
  return {
    kind: NodeKind.List,
    listKind: ListKind.TightExpression,
    delimiters: ["", ""],
    content: flattenLeftIfListKind(
      ListKind.TightExpression,
      nodeFromTsNode(postfixUnaryExpression.operand, file),
      [nodeFromTsNode(operatorToken, file)],
    ),
    equivalentToContent: true,
    pos: postfixUnaryExpression.pos,
    end: postfixUnaryExpression.end,
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
        ListKind.ParenthesizedExpression,
        ifStatement.expression.pos - 1,
        ifStatement.expression.end + 1,
      ),
      nodeFromTsNode(ifStatement.thenStatement, file),
    ],
    equivalentToContent: true,
    pos: ifStatement.pos,
    end: ifStatement.thenStatement.end,
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

function listNodeFromTsReturnStatement(
  returnStatement: ts.ReturnStatement,
  file: ts.SourceFile | undefined,
): ListNode {
  const content: Node[] = [];
  const structKeys: string[] = [];

  const firstToken = returnStatement.getFirstToken(file);
  if (!firstToken || firstToken.kind !== ts.SyntaxKind.ReturnKeyword) {
    throw new Error("missing or unsupported firstToken");
  }
  content.push(nodeFromTsNode(firstToken, file));
  structKeys.push("returnKeyword");

  if (returnStatement.expression) {
    content.push(nodeFromTsNode(returnStatement.expression, file));
    structKeys.push("expression");
  }

  return {
    kind: NodeKind.List,
    listKind: ListKind.TsNodeStruct,
    tsNode: returnStatement,
    delimiters: ["", ""],
    content,
    structKeys,
    equivalentToContent: true,
    pos: returnStatement.pos,
    end: returnStatement.end,
  };
}

function listNodeFromTsThrowStatement(
  throwStatement: ts.ThrowStatement,
  file: ts.SourceFile | undefined,
): ListNode {
  const content: Node[] = [];
  const structKeys: string[] = [];

  const firstToken = throwStatement.getFirstToken(file);
  if (!firstToken || firstToken.kind !== ts.SyntaxKind.ThrowKeyword) {
    throw new Error("missing or unsupported firstToken");
  }
  content.push(nodeFromTsNode(firstToken, file));
  structKeys.push("throwKeyword");

  content.push(nodeFromTsNode(throwStatement.expression, file));
  structKeys.push("expression");

  return {
    kind: NodeKind.List,
    listKind: ListKind.TsNodeStruct,
    tsNode: throwStatement,
    delimiters: ["", ""],
    content,
    structKeys,
    equivalentToContent: true,
    pos: throwStatement.pos,
    end: throwStatement.end,
  };
}

function listNodeFromTsVariableDeclarationList(
  variableDeclarationList: ts.VariableDeclarationList,
  file: ts.SourceFile | undefined,
): ListNode {
  const node = listNodeFromNonDelimitedTsNodeArray(
    variableDeclarationList.declarations,
    file,
    ListKind.TsNodeList,
  );
  node.tsNode = variableDeclarationList;
  node.pos = variableDeclarationList.pos;
  node.end = variableDeclarationList.end;

  const firstToken = variableDeclarationList.getFirstToken(file);
  if (!firstToken || !isTsVarLetConst(firstToken)) {
    throw new Error("missing or unsupported firstToken");
  }
  node.content.unshift(nodeFromTsNode(firstToken, file));

  return node;
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
    tsNode: block,
  };
}

function listNodeFromTsObjectLiteralExpression(
  objectLiteralExpression: ts.ObjectLiteralExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    ...listNodeFromDelimitedTsNodeArray(
      objectLiteralExpression.properties,
      file,
      ListKind.TsNodeList,
      objectLiteralExpression.pos,
      objectLiteralExpression.end,
    ),
    tsNode: objectLiteralExpression,
  };
}

function listNodeFromTsArrayLiteralExpression(
  arrayLiteralExpression: ts.ArrayLiteralExpression,
  file: ts.SourceFile | undefined,
): ListNode {
  return {
    ...listNodeFromDelimitedTsNodeArray(
      arrayLiteralExpression.elements,
      file,
      ListKind.TsNodeList,
      arrayLiteralExpression.pos,
      arrayLiteralExpression.end,
    ),
    tsNode: arrayLiteralExpression,
  };
}

function listNodeFromTsObjectLiteralElementLike(
  objectLiteralElementLike: ts.ObjectLiteralElementLike,
  file: ts.SourceFile | undefined,
): ListNode {
  const content: Node[] = [];
  const structKeys: string[] = [];

  if (ts.isPropertyAssignment(objectLiteralElementLike)) {
    content.push(nodeFromTsNode(objectLiteralElementLike.name, file));
    structKeys.push("name");
    content.push(nodeFromTsNode(objectLiteralElementLike.initializer, file));
    structKeys.push("initializer");
  } else if (ts.isShorthandPropertyAssignment(objectLiteralElementLike)) {
    content.push(nodeFromTsNode(objectLiteralElementLike.name, file));
    structKeys.push("name");
  } else if (ts.isSpreadAssignment(objectLiteralElementLike)) {
    const dotDotDotToken = objectLiteralElementLike.getFirstToken(file);
    if (!dotDotDotToken || !ts.isDotDotDotToken(dotDotDotToken)) {
      throw new Error("expected dotDotDotToken");
    }
    content.push(nodeFromTsNode(dotDotDotToken, file));
    structKeys.push("dotDotDotToken");
    content.push(nodeFromTsNode(objectLiteralElementLike.expression, file));
    structKeys.push("expression");
  } else {
    throw new Error(
      `this specific subtype of ObjectLiteralElementLike (${
        ts.SyntaxKind[objectLiteralElementLike.kind]
      }) is not yet supported`,
    );
  }

  return {
    kind: NodeKind.List,
    listKind: ListKind.ObjectLiteralElement,
    delimiters: ["", ""],
    content,
    structKeys,
    equivalentToContent: true,
    pos: objectLiteralElementLike.pos,
    end: objectLiteralElementLike.end,
  };
}

function tryMakeListNodeGeneric(
  node: ts.Node,
  file: ts.SourceFile | undefined,
): ListNode | undefined {
  if (!allowedGenericNodeMatchers.find((m) => m(node))) {
    return undefined;
  }

  const structTemplate: UnknownStructTemplate | undefined =
    structTemplates.find((t) => t.match(node)) as any;
  if (!structTemplate) {
    return undefined;
  }

  const children = structTemplate.load(node);

  const structKeys: string[] = [];
  const content: Node[] = [];

  for (const [i, modifierNode] of (node.modifiers || []).entries()) {
    structKeys.push(`modifiers[${i}]`);
    content.push(nodeFromTsNode(modifierNode, file));
  }

  if (structTemplate.keyword) {
    if (file) {
      const keywordToken = node
        .getChildren(file)
        .find((c) => c.kind === structTemplate.keyword);
      if (!keywordToken) {
        throw new Error("missing keyword");
      }
      content.push(nodeFromTsNode(keywordToken, file));
      structKeys.push("keyword");
    } else {
      content.push(
        nodeFromTsNode(
          ts.factory.createToken(structTemplate.keyword),
          undefined,
        ),
      );
      structKeys.push("keyword");
    }
  }

  for (const k of structTemplate.children) {
    const child = children[k];

    if (child.optional && child.value === undefined) {
      continue;
    }

    if (child.isList) {
      structKeys.push(k);
      content.push(
        listNodeFromAutoTsNodeArray(
          child.value!,
          node,
          file,
          ListKind.UnknownTsNodeArray,
        ),
      );
    } else {
      structKeys.push(k);
      content.push(nodeFromTsNode(child.value!, file));
    }
  }

  return {
    kind: NodeKind.List,
    listKind: ListKind.TsNodeStruct,
    tsNode: node,
    delimiters: ["", ""],
    structKeys,
    content,
    equivalentToContent: true,
    pos: node.pos,
    end: node.end,
  };
}

export function nodeFromTsNode(
  node: ts.Node,
  file: ts.SourceFile | undefined,
): Node {
  if (ts.isCallExpression(node)) {
    return listNodeFromTsCallExpression(node, file);
  } else if (ts.isPropertyAccessExpression(node)) {
    return listNodeFromTsPropertyAccessExpression(node, file);
  } else if (ts.isNonNullExpression(node)) {
    return listNodeFromTsNonNullExpression(node, file);
  } else if (ts.isPostfixUnaryExpression(node)) {
    return listNodeFromTsPostfixUnaryExpression(node, file);
  } else if (ts.isBinaryExpression(node)) {
    return listNodeFromTsBinaryExpression(node, file);
  } else if (ts.isParenthesizedExpression(node)) {
    return listNodeFromTsParenthesizedExpression(node, file);
  } else if (ts.isIfStatement(node)) {
    return listNodeFromTsIfStatement(node, file);
  } else if (ts.isReturnStatement(node)) {
    return listNodeFromTsReturnStatement(node, file);
  } else if (ts.isThrowStatement(node)) {
    return listNodeFromTsThrowStatement(node, file);
  } else if (ts.isVariableDeclarationList(node)) {
    return listNodeFromTsVariableDeclarationList(node, file);
  } else if (ts.isBlock(node)) {
    return listNodeFromTsBlock(node, file);
  } else if (ts.isObjectLiteralExpression(node)) {
    return listNodeFromTsObjectLiteralExpression(node, file);
  } else if (ts.isArrayLiteralExpression(node)) {
    return listNodeFromTsArrayLiteralExpression(node, file);
  } else if (ts.isObjectLiteralElementLike(node)) {
    return listNodeFromTsObjectLiteralElementLike(node, file);
  } else {
    return (
      tryMakeListNodeGeneric(node, file) || {
        kind: NodeKind.Token,
        pos: node.pos,
        end: node.end,
        tsNode: node,
      }
    );
  }
}

function trimRanges(rootNode: ListNode, file: ts.SourceFile): ListNode {
  const cb = (pos: number, end: number): [number, number] => {
    while (pos <= end && pos < file.text.length && file.text[pos].match(/\s/)) {
      pos++;
    }
    while (end >= pos && end > 0 && file.text[end - 1].match(/\s/)) {
      end--;
    }
    return [pos, end];
  };
  return mapNodeTextRanges(rootNode, cb);
}

export function docFromAst(file: ts.SourceFile): Doc {
  return {
    root: trimRanges(
      {
        kind: NodeKind.List,
        listKind: ListKind.File,
        delimiters: ["", ""],
        content: file.statements.map((s) => nodeFromTsNode(s, file)),
        equivalentToContent: true,
        pos: file.pos,
        end: file.end,
      },
      file,
    ),
    text: file.text,
  };
}
