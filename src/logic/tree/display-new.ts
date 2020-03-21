import { Node } from "../tree/node";
import { isMetaBranchNode } from "../transform/transforms/split-meta";
import {
  Node as DivetreeDisplayNode,
  NodeKind,
  NavNode,
  TightLeafNode,
  Split,
} from "divetree-core";
import { IncrementalParentIndex } from "../parent-index";

export function getNodeForDisplay(
  node: Node<unknown>,
  metaLevelNodeIds: Set<string>,
): Node<unknown> {
  if (isMetaBranchNode(node)) {
    const selectedBranch = metaLevelNodeIds.has(node.id) ? "meta" : "primary";
    return node.children.find(c => c.key === selectedBranch)!.node;
  }
  return node;
}

export function buildDivetreeDisplayTree(
  node: Node<unknown>,
  path: string[],
  extraDepth: number,
  metaLevelNodeIds: Set<string>,
  incrementalParentIndex: IncrementalParentIndex,
): DivetreeDisplayNode {
  const isOnPath = node.id === path[0];
  const isFinal = !isOnPath || !!extraDepth;

  const nodeForDisplay = getNodeForDisplay(node, metaLevelNodeIds);
  const children = nodeForDisplay.children;

  incrementalParentIndex.addObservation(node);
  incrementalParentIndex.addObservation(nodeForDisplay);

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
  return {
    kind: NodeKind.Loose,
    id: node.id + "-loose", // HACK This suffix wont work if "id" is an arbitrary string
    parent: base,
    children: children.map(c => {
      return buildDivetreeDisplayTree(
        c.node,
        isOnPath ? path.slice(1) : [],
        extraDepth + (isOnPath ? 0 : 1),
        metaLevelNodeIds,
        incrementalParentIndex,
      );
    }),
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
      nodeForDisplay.children.map(c =>
        buildDivetreeNavTree(c.node, metaLevelNodeIds, incrementalParentIndex),
      ),
  };
}
