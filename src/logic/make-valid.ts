import ts from "typescript";
import { ListKind, ListNode, Node, NodeKind, Path } from "./interfaces";
import { isTsBinaryOperatorToken } from "./binary-operator";
import { nodeFromTsNode } from "./node-from-ts";
import { PathMapper } from "./path-mapper";
import { pathsAreEqual } from "./path-utils";
import { withDefaultContent } from "./struct";

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
    const placeholder = {
      ...nodeFromTsNode(ts.createIdentifier("placeholder"), undefined),
      isPlaceholder: true,
    };
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
      ({ node: c, oldIndex, newIndex }) => {
        if (oldIndex === undefined) {
          return c;
        }
        return _makeNodeValidTs({
          node: c,
          pathMapper,
          oldPath: [...oldPath, oldIndex],
          newPath: [...newPath, newIndex],
        });
      },
    );
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
