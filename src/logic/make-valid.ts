import { last } from "ramda";
import ts, { isDotDotDotToken } from "typescript";
import {
  allowedGenericNodeMatchers,
  UnknownStructTemplate,
} from "./generic-node";
import { ListKind, ListNode, Node, NodeKind, Path } from "./interfaces";
import { StructChild, Union } from "./legacy-templates/interfaces";
import { matchesUnion } from "./legacy-templates/match";
import { structTemplates } from "./legacy-templates/templates";
import { getModifierSyntaxKinds, isModifierKey } from "./modifier";
import { nodeFromTsNode } from "./node-from-ts";
import { PathMapper } from "./path-mapper";
import { pathsAreEqual } from "./path-utils";
import {
  assertNodeHasValidStructKeys,
  getStructContent,
  withDefaultContent,
} from "./struct";
import { onlyChildFromNode } from "./tree-utils/access";
import { tsNodeFromNode } from "./ts-from-node";
import {
  isToken,
  isTsBinaryOperatorToken,
  isTsExclamationToken,
  isTsQuestionDotToken,
  isTsVarLetConst,
} from "./ts-type-predicates";

export function makeNodeValidTs(node: ListNode): {
  node: ListNode;
  pathMapper: PathMapper;
};
export function makeNodeValidTs(node: Node): {
  node: Node;
  pathMapper: PathMapper;
};
export function makeNodeValidTs(node: Node): {
  node: Node;
  pathMapper: PathMapper;
} {
  const pathMapper = new PathMapper([]);
  return {
    node: _makeNodeValidTs({
      node,
      pathMapper,
      oldPath: [],
      newPath: [],
      extraInfo: {},
    }),
    pathMapper,
  };
}

function makePlaceholderIdentifier(): Node {
  return {
    ...nodeFromTsNode(ts.createIdentifier("placeholder"), undefined),
    isPlaceholder: true,
  };
}

function makePlaceholderForUnion(union: Union<ts.Node>): Node {
  const placeholders: Node[] = [
    makePlaceholderIdentifier(),
    {
      ...nodeFromTsNode(
        ts.factory.createTypeReferenceNode("placeholder"),
        undefined,
      ),
      isPlaceholder: true,
    },
  ];
  const matchingPlaceholder = placeholders.find((p) =>
    matchesUnion(tsNodeFromNode(p), union),
  );
  if (!matchingPlaceholder) {
    throw new Error(`can not make placeholder for union ${union.name}`);
  }
  return matchingPlaceholder;
}

function isEmptyListNode(node: Node): node is ListNode & { content: [] } {
  return node.kind === NodeKind.List && !node.content.length;
}

export interface WithInsertedContentMapArgs {
  oldIndex?: number;
  newIndex: number;
  node: Node;
}

function reinsertPlaceholdersIntoContent(
  oldContent: Node[],
  shouldInsert: (
    newLeft: Node | undefined,
    oldRight: Node | undefined,
  ) => Node | undefined,
  map: (args: WithInsertedContentMapArgs) => Node,
): Node[] {
  const newContent: Node[] = [];
  const mapAndPush = ({
    node,
    oldIndex,
  }: {
    node: Node;
    oldIndex?: number;
  }) => {
    const mappedNode = map({
      oldIndex,
      newIndex: newContent.length,
      node,
    });
    newContent.push(mappedNode);
  };

  let oldIndex = 0;
  while (true) {
    let oldIndexExcludingPlaceholders = oldIndex;
    while (
      oldIndexExcludingPlaceholders < oldContent.length &&
      oldContent[oldIndexExcludingPlaceholders].isPlaceholder
    ) {
      oldIndexExcludingPlaceholders++;
    }
    const oldNode =
      oldIndexExcludingPlaceholders < oldContent.length
        ? oldContent[oldIndexExcludingPlaceholders]
        : undefined;

    const newNode = shouldInsert(last(newContent), oldNode);
    if (newNode && oldIndex === oldIndexExcludingPlaceholders) {
      // insert before non-placeholder node
      mapAndPush({ node: newNode });
    } else if (newNode) {
      // replace placeholder node
      mapAndPush({ node: newNode, oldIndex });
      oldIndex++;
    } else if (!oldNode) {
      // consumed all nodes except trailing placeholders
      break;
    } else {
      // consume and output old node
      mapAndPush({ node: oldNode, oldIndex });
      oldIndex = oldIndexExcludingPlaceholders + 1;
    }
  }

  return newContent;
}

function makeLooseExpressionValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return reinsertPlaceholdersIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      if (
        newLeft === undefined &&
        oldRight !== undefined &&
        isToken(oldRight, isTsBinaryOperatorToken)
      ) {
        return makePlaceholderIdentifier();
      } else if (
        newLeft !== undefined &&
        isToken(newLeft, isTsBinaryOperatorToken) &&
        oldRight === undefined
      ) {
        return makePlaceholderIdentifier();
      } else if (
        newLeft !== undefined &&
        isToken(newLeft, isTsBinaryOperatorToken) &&
        oldRight !== undefined &&
        isToken(oldRight, isTsBinaryOperatorToken)
      ) {
        return makePlaceholderIdentifier();
      } else if (
        newLeft !== undefined &&
        !isToken(newLeft, isTsBinaryOperatorToken) &&
        oldRight !== undefined &&
        !isToken(oldRight, isTsBinaryOperatorToken)
      ) {
        return {
          ...nodeFromTsNode(ts.createToken(ts.SyntaxKind.PlusToken), undefined),
          isPlaceholder: true,
        };
      } else {
        return undefined;
      }
    },
    mapChild,
  );
}

function makeTightExpressionValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return reinsertPlaceholdersIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      if (
        newLeft === undefined &&
        oldRight !== undefined &&
        ((oldRight.kind === NodeKind.List &&
          oldRight.listKind === ListKind.CallArguments) ||
          isToken(oldRight, isTsQuestionDotToken) ||
          isToken(oldRight, isTsExclamationToken))
      ) {
        return makePlaceholderIdentifier();
      }
      if (
        newLeft !== undefined &&
        isToken(newLeft, isTsQuestionDotToken) &&
        (oldRight === undefined || isToken(oldRight, isTsQuestionDotToken))
      ) {
        return makePlaceholderIdentifier();
      }
      return undefined;
    },
    mapChild,
  );
}

function makeVariableDeclarationListValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return reinsertPlaceholdersIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      if (
        newLeft === undefined &&
        oldRight !== undefined &&
        !isToken(oldRight, isTsVarLetConst)
      ) {
        return {
          ...nodeFromTsNode(
            ts.createToken(ts.SyntaxKind.VarKeyword),
            undefined,
          ),
          isPlaceholder: true,
        };
      }
      if (
        newLeft !== undefined &&
        isToken(newLeft, isTsVarLetConst) &&
        oldRight === undefined
      ) {
        return {
          ...nodeFromTsNode(
            ts.createVariableDeclaration(ts.createIdentifier("placeholder")),
            undefined,
          ),
          isPlaceholder: true,
        };
      }
      return undefined;
    },
    mapChild,
  );
}

function makeReturnStatementValidTs(
  oldNode: ListNode,
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node {
  if (
    (oldNode.structKeys?.length === 2 &&
      oldNode.structKeys[0] === "returnKeyword" &&
      oldNode.structKeys[1] === "expression") ||
    (oldNode.structKeys?.length === 1 &&
      oldNode.structKeys[0] === "returnKeyword")
  ) {
    return {
      ...oldNode,
      content: oldNode.content.map((c, i) =>
        mapChild({ node: c, oldIndex: i, newIndex: i }),
      ),
    };
  } else if (
    oldNode.structKeys?.length === 1 &&
    oldNode.structKeys[0] === "expression"
  ) {
    const expressionStatementNode = nodeFromTsNode(
      ts.factory.createExpressionStatement(ts.factory.createIdentifier("")),
      undefined,
    );
    if (
      expressionStatementNode.kind !== NodeKind.List ||
      expressionStatementNode.structKeys?.length !== 1 ||
      expressionStatementNode.structKeys[0] !== "expression"
    ) {
      throw new Error("expressionStatementNode has unexpected structure");
    }
    return {
      ...expressionStatementNode,
      content: [
        mapChild({ node: oldNode.content[0], oldIndex: 0, newIndex: 0 }),
      ],
    };
  } else {
    throw new Error("unsupported structKeys");
  }
}

function makeThrowStatementValidTs(
  oldNode: ListNode,
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node {
  if (
    oldNode.structKeys?.length === 1 &&
    oldNode.structKeys[0] === "expression"
  ) {
    const expressionStatementNode = nodeFromTsNode(
      ts.factory.createExpressionStatement(ts.factory.createIdentifier("")),
      undefined,
    );
    if (
      expressionStatementNode.kind !== NodeKind.List ||
      expressionStatementNode.structKeys?.length !== 1 ||
      expressionStatementNode.structKeys[0] !== "expression"
    ) {
      throw new Error("expressionStatementNode has unexpected structure");
    }
    return {
      ...expressionStatementNode,
      content: [
        mapChild({ node: oldNode.content[0], oldIndex: 0, newIndex: 0 }),
      ],
    };
  } else {
    return withDefaultContent(
      oldNode,
      [
        { key: "throwKeyword" },
        { key: "expression", node: makePlaceholderIdentifier() },
      ],
      mapChild,
    );
  }
}

function makePropertyAssignmentValidTs(
  oldContent: Node[],
  oldStructKeys: string[] | undefined,
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  if (!oldStructKeys || oldStructKeys.length !== oldContent.length) {
    throw new Error("structKeys is missing or has wrong length");
  }

  if (
    oldStructKeys.length === 2 &&
    oldStructKeys[0] === "name" &&
    oldStructKeys[1] === "initializer"
  ) {
    return oldContent.map((c, i) =>
      mapChild({ node: c, oldIndex: i, newIndex: i }),
    );
  } else if (oldStructKeys.length === 1 && oldStructKeys[0] === "name") {
    return [
      mapChild({ node: oldContent[0], oldIndex: 0, newIndex: 0 }),
      mapChild({ node: makePlaceholderIdentifier(), newIndex: 1 }),
    ];
  } else if (oldStructKeys.length === 1 && oldStructKeys[0] === "initializer") {
    return [
      mapChild({ node: makePlaceholderIdentifier(), newIndex: 0 }),
      mapChild({ node: oldContent[0], oldIndex: 0, newIndex: 1 }),
    ];
  } else {
    throw new Error("unsupported structKeys");
  }
}

function makeShorthandPropertyAssignmentValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return [mapChild({ node: oldContent[0], oldIndex: 0, newIndex: 0 })];
}

function makeSpreadAssignmentValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return reinsertPlaceholdersIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      if (
        newLeft !== undefined &&
        isToken(newLeft, isDotDotDotToken) &&
        oldRight === undefined
      ) {
        return makePlaceholderIdentifier();
      }
      return undefined;
    },
    mapChild,
  );
}

function makeObjectLiteralElementValidTs(
  oldNode: ListNode,
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): ListNode {
  if (oldNode.content.length < 1) {
    throw new Error("ObjectLiteralElement must have at least 1 child");
  }

  const oldContentWithoutPlaceholders = oldNode.content.filter(
    (c) => !c.isPlaceholder,
  );

  if (isToken(oldNode.content[0], ts.isDotDotDotToken)) {
    return {
      ...oldNode,
      content: makeSpreadAssignmentValidTs(oldNode.content, mapChild),
      structKeys: ["dotDotDotToken", "expression"],
    };
  } else if (
    oldContentWithoutPlaceholders.length === 1 &&
    isToken(oldContentWithoutPlaceholders[0], ts.isIdentifier)
  ) {
    return {
      ...oldNode,
      content: makeShorthandPropertyAssignmentValidTs(
        oldContentWithoutPlaceholders,
        mapChild,
      ),
      structKeys: ["name"],
    };
  } else {
    return {
      ...oldNode,
      content: makePropertyAssignmentValidTs(
        oldNode.content,
        oldNode.structKeys,
        mapChild,
      ),
      structKeys: ["name", "initializer"],
    };
  }
}

function tryMakeGenericStructNodeValidTs(
  oldNode: ListNode,
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
  overrideTemplateChildren?: (old: { [key: string]: StructChild<ts.Node> }) => {
    [key: string]: StructChild<ts.Node>;
  },
): ListNode | undefined {
  const oldTsNode = oldNode.tsNode;
  if (!oldTsNode || !allowedGenericNodeMatchers.find((m) => m(oldTsNode))) {
    return undefined;
  }

  const structTemplate: UnknownStructTemplate | undefined =
    structTemplates.find((t) => t.match(oldTsNode)) as any;
  if (!structTemplate) {
    return undefined;
  }

  const modifierKeys = (oldNode.structKeys || []).filter((k) =>
    isModifierKey(k),
  );
  const oldContent = getStructContent(
    oldNode,
    structTemplate.keyword ? ["keyword"] : [],
    [...structTemplate.children, ...modifierKeys],
  );
  let templateChildren = structTemplate.load(oldTsNode);
  if (overrideTemplateChildren) {
    templateChildren = overrideTemplateChildren(templateChildren);
  }

  const newNode: ListNode & { structKeys: string[] } = {
    ...oldNode,
    content: [],
    structKeys: [],
  };

  for (const k of modifierKeys) {
    const newIndex = newNode.content.length;
    newNode.content.push(
      mapChild({
        node: oldContent[k]!,
        oldIndex: oldNode.structKeys!.indexOf(k),
        newIndex,
      }),
    );
    newNode.structKeys.push(k);
  }

  if (oldContent.keyword) {
    newNode.content.push(oldContent.keyword);
    newNode.structKeys.push("keyword");
  }

  for (const k of structTemplate.children) {
    const templateChild = templateChildren[k];
    const newIndex = newNode.content.length;
    if (oldContent[k]) {
      newNode.content.push(
        mapChild({
          node: oldContent[k]!,
          oldIndex: oldNode.structKeys!.indexOf(k),
          newIndex,
        }),
      );
      newNode.structKeys.push(k);
    } else if (!templateChild.optional) {
      if (templateChild.isList) {
        throw new Error("can not make placeholder for list child");
      }
      newNode.content.push(
        mapChild({
          node: makePlaceholderForUnion(templateChild.union),
          newIndex,
        }),
      );
      newNode.structKeys.push(k);
    }
  }

  return newNode;
}

interface ExtraInfo {
  couldBeElseBranch?: boolean;
}

function _makeNodeValidTs({
  node,
  pathMapper,
  oldPath,
  newPath,
  extraInfo,
}: {
  node: Node;
  pathMapper: PathMapper;
  oldPath: Path;
  newPath: Path;
  extraInfo: ExtraInfo;
}): Node {
  function extractOnlyNonPlaceholderChild(node: ListNode): Node {
    const i = node.content.findIndex((c) => !c.isPlaceholder);
    if (i === -1) {
      throw new Error("there is no non-placeholder child");
    }
    return _makeNodeValidTs({
      node: onlyChildFromNode({
        ...node,
        content: [node.content[i]],
      }),
      pathMapper,
      oldPath: [...oldPath, i],
      newPath: [...newPath],
      extraInfo: {},
    });
  }

  function mapChild({
    node,
    oldIndex,
    newIndex,
    extraInfo,
  }: {
    node: Node;
    oldIndex?: number;
    newIndex: number;
    extraInfo?: ExtraInfo;
  }): Node {
    if (oldIndex === undefined) {
      return node;
    }
    return _makeNodeValidTs({
      node: node,
      pathMapper,
      oldPath: [...oldPath, oldIndex],
      newPath: [...newPath, newIndex],
      extraInfo: extraInfo || {},
    });
  }

  if (!pathsAreEqual(oldPath, newPath)) {
    pathMapper.record({ old: oldPath, new: newPath });
  }

  if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TightExpression
  ) {
    if (makeTightExpressionValidTs(node.content, (e) => e.node).length === 1) {
      node = extractOnlyNonPlaceholderChild(node);
    } else {
      node = {
        ...node,
        content: makeTightExpressionValidTs(node.content, mapChild),
      };
    }
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.LooseExpression
  ) {
    if (makeLooseExpressionValidTs(node.content, (e) => e.node).length === 1) {
      node = extractOnlyNonPlaceholderChild(node);
    } else {
      node = {
        ...node,
        content: makeLooseExpressionValidTs(node.content, mapChild),
      };
    }
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TsNodeList &&
    node.tsNode?.kind === ts.SyntaxKind.VariableDeclarationList
  ) {
    node = {
      ...node,
      content: makeVariableDeclarationListValidTs(node.content, mapChild),
    };
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TsNodeStruct &&
    node.tsNode?.kind === ts.SyntaxKind.ReturnStatement
  ) {
    node = makeReturnStatementValidTs(node, mapChild);
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TsNodeStruct &&
    node.tsNode?.kind === ts.SyntaxKind.ThrowStatement
  ) {
    node = makeThrowStatementValidTs(node, mapChild);
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TsNodeStruct &&
    node.tsNode?.kind === ts.SyntaxKind.FunctionDeclaration
  ) {
    const modifierSyntaxKinds = getModifierSyntaxKinds(node);
    const hasDefaultExport =
      modifierSyntaxKinds.includes(ts.SyntaxKind.ExportKeyword) &&
      modifierSyntaxKinds.includes(ts.SyntaxKind.DefaultKeyword);

    const genericNode = tryMakeGenericStructNodeValidTs(
      node,
      mapChild,
      (oldTemplateChildren): typeof oldTemplateChildren => {
        if (hasDefaultExport) {
          return oldTemplateChildren;
        }
        return {
          ...oldTemplateChildren,
          name: {
            ...(oldTemplateChildren.name as any),
            optional: false,
          } as StructChild<ts.Node>,
        };
      },
    );

    if (!genericNode) {
      throw new Error("expected generic support for FunctionDeclaration");
    }
    node = genericNode;
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.IfBranches
  ) {
    const oldContent = node.content;
    node = {
      ...node,
      content: node.content.map((c, i) =>
        mapChild({
          node: c,
          oldIndex: i,
          newIndex: i,
          extraInfo: {
            couldBeElseBranch: i > 0 && i + 1 === oldContent.length,
          },
        }),
      ),
    };
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.IfBranch
  ) {
    assertNodeHasValidStructKeys(node);
    const structKeys = node.structKeys;
    node = {
      ...node,
      content: node.content.map((c, i) => {
        if (structKeys[i] === "expression" && isEmptyListNode(c)) {
          return {
            ...c,
            content: [makePlaceholderIdentifier()],
          };
        } else {
          return mapChild({
            node: c,
            oldIndex: i,
            newIndex: i,
          });
        }
      }),
    };
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.ObjectLiteralElement
  ) {
    node = makeObjectLiteralElementValidTs(node, mapChild);
  } else if (node.kind === NodeKind.List) {
    node = tryMakeGenericStructNodeValidTs(node, mapChild) || {
      ...node,
      content: node.content.map((c, i) =>
        mapChild({ node: c, oldIndex: i, newIndex: i }),
      ),
    };
  }
  return node;
}
