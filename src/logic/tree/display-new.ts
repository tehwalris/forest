import {
  NavNode,
  NodeKind,
  RootNode as DivetreeDisplayRootNode,
  Split,
  TightLeafNode,
} from "divetree-core";
import { IncrementalParentIndex } from "../parent-index";
import { isMetaBranchNode } from "../transform/transforms/split-meta";
import { Node } from "../tree/node";
import { PostLayoutHints } from "../layout-hints";

export function getNodeForDisplay(
  node: Node<unknown>,
  metaLevelNodeIds: Set<string>,
): Node<unknown> {
  if (isMetaBranchNode(node)) {
    const selectedBranch = metaLevelNodeIds.has(node.id) ? "meta" : "primary";
    return node.children.find((c) => c.key === selectedBranch)!.node;
  }
  return node;
}

export function buildDivetreeDisplayTree(
  node: Node<unknown>,
  focusPath: string[],
  extraDepth: number,
  metaLevelNodeIds: Set<string>,
  incrementalParentIndex: IncrementalParentIndex,
  postLayoutHintsById: Map<string, PostLayoutHints>,
): DivetreeDisplayRootNode {
  const isOnFocusPath = node.id === focusPath[0];
  const isFinal = !isOnFocusPath || !!extraDepth;

  const nodeForDisplay = getNodeForDisplay(node, metaLevelNodeIds);
  const children = nodeForDisplay.children;

  incrementalParentIndex.addObservation(node);
  incrementalParentIndex.addObservation(nodeForDisplay);
  const parentPath = incrementalParentIndex.get(nodeForDisplay.id)?.path;
  if (!parentPath) {
    throw new Error(
      "could not get parentPath for node that was just added to index",
    );
  }

  const buildChildDisplayTree = (childNode: Node<unknown>) =>
    buildDivetreeDisplayTree(
      childNode,
      isOnFocusPath ? focusPath.slice(1) : [],
      extraDepth + (isOnFocusPath ? 0 : 1),
      metaLevelNodeIds,
      incrementalParentIndex,
      postLayoutHintsById,
    );

  const customDisplayTree = node.buildDivetreeDisplayTree({
    nodeForDisplay,
    isOnFocusPath,
    isFinal,
    parentPath,
    buildChildDisplayTree,
    setPostLayoutHints: postLayoutHintsById.set.bind(postLayoutHintsById),
  });
  if (customDisplayTree) {
    return customDisplayTree;
  }

  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [150, 56],
  };
  if (isFinal) {
    if (!children.length) {
      return base;
    }
    return {
      kind: NodeKind.TightSplit,
      split: Split.SideBySide,
      children: [
        { ...base, size: [75, 56] },
        {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: children.slice(0, 4).map(
            (c): TightLeafNode => ({
              kind: NodeKind.TightLeaf,
              id: c.node.id,
              size: [75, 25],
            }),
          ),
        },
      ],
    };
  }

  if (!children.length) {
    // HACK returning an loose node with no children instead breaks some code that expects tight nodes
    return base;
  }

  return {
    kind: NodeKind.Loose,
    id: node.id + "-loose", // HACK This suffix wont work if "id" is an arbitrary string
    parent: base,
    children: children.map((c) => buildChildDisplayTree(c.node)),
  };
}

export function buildDivetreeNavTree(
  node: Node<unknown>,
  metaLevelNodeIds: Set<string>,
  incrementalParentIndex?: IncrementalParentIndex,
): NavNode {
  const nodeForDisplay = getNodeForDisplay(node, metaLevelNodeIds);
  if (incrementalParentIndex) {
    incrementalParentIndex.addObservation(node);
    incrementalParentIndex.addObservation(nodeForDisplay);
  }
  return {
    id: node.id,
    getChildren: () =>
      nodeForDisplay.children.map((c) =>
        buildDivetreeNavTree(c.node, metaLevelNodeIds, incrementalParentIndex),
      ),
  };
}
