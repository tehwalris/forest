import ts from "typescript";
import { ListKind, ListNode, Node, NodeKind, Path } from "./interfaces";
import { nodeFromTsNode } from "./node-from-ts";
import { PathMapper } from "./path-mapper";
import { pathsAreEqual } from "./path-utils";
import { withDefaultContent } from "./struct";
import {
  isToken,
  isTsBinaryOperatorToken,
  isTsQuestionDotToken,
} from "./ts-type-predicates";
import { last } from "ramda";

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
    node: _makeNodeValidTs({ node, pathMapper, oldPath: [], newPath: [] }),
    pathMapper,
  };
}

export interface WithInsertedContentMapArgs {
  oldIndex?: number;
  newIndex: number;
  node: Node;
}

function insertIntoContent(
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
    const oldNode =
      oldIndex < oldContent.length ? oldContent[oldIndex] : undefined;
    const newNode = shouldInsert(last(newContent), oldNode);
    if (newNode) {
      mapAndPush({ node: newNode });
    } else if (!oldNode) {
      break;
    } else {
      mapAndPush({ node: oldNode, oldIndex });
      oldIndex++;
    }
  }

  return newContent;
}

function makeLooseExpressionValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex: number; newIndex: number }) => Node,
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

function makeTightExpressionValidTs(
  oldContent: Node[],
  mapChild: (args: { node: Node; oldIndex?: number; newIndex: number }) => Node,
): Node[] {
  return insertIntoContent(
    oldContent,
    (newLeft, oldRight) => {
      const placeholder = {
        ...nodeFromTsNode(ts.createIdentifier("placeholder"), undefined),
        isPlaceholder: true,
      };
      if (
        newLeft === undefined &&
        oldRight !== undefined &&
        ((oldRight.kind === NodeKind.List &&
          oldRight.listKind === ListKind.CallArguments) ||
          isToken(oldRight, isTsQuestionDotToken))
      ) {
        return placeholder;
      }
      if (
        newLeft !== undefined &&
        isToken(newLeft, isTsQuestionDotToken) &&
        (oldRight === undefined || isToken(oldRight, isTsQuestionDotToken))
      ) {
        return placeholder;
      }
      return undefined;
    },
    mapChild,
  );
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
  function extractOnlyChild(node: ListNode): Node {
    if (node.content.length !== 1) {
      throw new Error(
        `want node.content.length === 1, got ${node.content.length}`,
      );
    }
    return _makeNodeValidTs({
      node: node.content[0],
      pathMapper,
      oldPath: [...oldPath, 0],
      newPath: [...newPath],
    });
  }

  function mapChild({
    node,
    oldIndex,
    newIndex,
  }: {
    node: Node;
    oldIndex?: number;
    newIndex: number;
  }): Node {
    if (oldIndex === undefined) {
      return node;
    }
    return _makeNodeValidTs({
      node: node,
      pathMapper,
      oldPath: [...oldPath, oldIndex],
      newPath: [...newPath, newIndex],
    });
  }

  if (!pathsAreEqual(oldPath, newPath)) {
    pathMapper.record({ old: oldPath, new: newPath });
  }

  if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TightExpression
  ) {
    if (
      node.content.length === 1 &&
      makeTightExpressionValidTs(node.content, (e) => e.node).length === 1
    ) {
      node = extractOnlyChild(node);
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
    if (
      node.content.length === 1 &&
      makeLooseExpressionValidTs(node.content, (e) => e.node).length === 1
    ) {
      node = extractOnlyChild(node);
    } else {
      node = {
        ...node,
        content: makeLooseExpressionValidTs(node.content, mapChild),
      };
    }
  } else if (
    node.kind === NodeKind.List &&
    node.listKind === ListKind.TsNodeStruct &&
    node.tsSyntaxKind === ts.SyntaxKind.ArrowFunction
  ) {
    node = withDefaultContent(
      node,
      [
        { key: "modifiers" },
        { key: "typeParameters" },
        { key: "parameters" },
        { key: "equalsGreaterThanToken" },
        {
          key: "body",
          node: {
            ...nodeFromTsNode(ts.createIdentifier("placeholder"), undefined),
            isPlaceholder: true,
          },
        },
      ],
      mapChild,
    );
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
