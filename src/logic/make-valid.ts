import { last } from "ramda";
import ts, { isDotDotDotToken } from "typescript";
import { ListKind, ListNode, Node, NodeKind, Path } from "./interfaces";
import { nodeFromTsNode } from "./node-from-ts";
import { PathMapper } from "./path-mapper";
import { pathsAreEqual } from "./path-utils";
import { assertNodeHasValidStructKeys, withDefaultContent } from "./struct";
import { onlyChildFromNode } from "./tree-utils/access";
import {
  isToken,
  isTsBinaryOperatorToken,
  isTsColonToken,
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
          isToken(oldRight, isTsQuestionDotToken))
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

function makePropertyAssignmentValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return reinsertPlaceholdersIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      if (
        newLeft === undefined &&
        oldRight !== undefined &&
        isToken(oldRight, isTsColonToken)
      ) {
        return makePlaceholderIdentifier();
      }
      if (
        newLeft !== undefined &&
        isToken(newLeft, isTsColonToken) &&
        oldRight === undefined
      ) {
        return makePlaceholderIdentifier();
      }
      return undefined;
    },
    mapChild,
  );
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
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  if (oldContent.length < 1) {
    throw new Error("ObjectLiteralElement must have at least 1 child");
  }
  if (isToken(oldContent[0], ts.isDotDotDotToken)) {
    return makeSpreadAssignmentValidTs(oldContent, mapChild);
  } else if (oldContent.length === 1) {
    return makeShorthandPropertyAssignmentValidTs(oldContent, mapChild);
  } else {
    return makePropertyAssignmentValidTs(oldContent, mapChild);
  }
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
    return _makeNodeValidTs({
      node: onlyChildFromNode({
        ...node,
        content: node.content.filter((c) => !c.isPlaceholder),
      }),
      pathMapper,
      oldPath: [...oldPath, 0],
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
    node.listKind === ListKind.TsNodeStruct &&
    node.tsNode?.kind === ts.SyntaxKind.ArrowFunction
  ) {
    node = withDefaultContent(
      node,
      [
        { key: "modifiers" },
        { key: "typeParameters" },
        { key: "parameters" },
        { key: "equalsGreaterThanToken" },
        { key: "body", node: makePlaceholderIdentifier() },
      ],
      mapChild,
    );
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
    node.tsNode?.kind === ts.SyntaxKind.VariableDeclaration
  ) {
    node = withDefaultContent(
      node,
      [
        { key: "name", node: makePlaceholderIdentifier() },
        { key: "type" },
        { key: "initializer" },
      ],
      mapChild,
    );
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
    node = {
      ...node,
      content: makeObjectLiteralElementValidTs(node.content, mapChild),
    };
  } else if (node.kind === NodeKind.List) {
    node = {
      ...node,
      content: node.content.map((c, i) =>
        mapChild({ node: c, oldIndex: i, newIndex: i }),
      ),
    };
  }
  return node;
}
