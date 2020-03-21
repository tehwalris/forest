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

// TODO Move these interfaces to parent-index.ts
export type ParentPathElement = { parent: Node<unknown>; childKey: string };

export interface ParentIndex {
  get(nodeId: string): ParentIndexEntry | undefined;
  has(nodeId: string): boolean;
}

export type ParentIndexEntry = {
  node: Node<unknown>;
  path: ParentPathElement[];
};

export function idPathFromParentIndexEntry(entry: ParentIndexEntry): string[] {
  return [...entry.path.map(e => e.parent), entry.node].map(e => e.id);
}

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

export function buildParentIndex(
  root: Node<unknown>,
  result: Map<string, ParentIndexEntry> = new Map(),
  path: ParentPathElement[] = [],
): ParentIndex {
  result.set(root.id, { node: root, path });
  root.children.forEach(c =>
    buildParentIndex(c.node, result, [
      ...path,
      { parent: root, childKey: c.key },
    ]),
  );
  return result;
}

export function getMetaBranchBranchIds(
  root: Node<unknown>,
  result = new Set<string>(),
  parentIsMetaBranchNode = false,
): Set<string> {
  if (parentIsMetaBranchNode) {
    result.add(root.id);
  }
  root.children.forEach(c =>
    getMetaBranchBranchIds(c.node, result, isMetaBranchNode(root)),
  );
  return result;
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
  if (incrementalParentIndex) {
    incrementalParentIndex.addObservation(node);
    incrementalParentIndex.addObservation(
      getNodeForDisplay(node, metaLevelNodeIds),
    );
  }
  return {
    id: node.id,
    children: getNodeForDisplay(node, metaLevelNodeIds).children.map(c =>
      buildDivetreeNavTree(c.node, metaLevelNodeIds, incrementalParentIndex),
    ),
  };
}
