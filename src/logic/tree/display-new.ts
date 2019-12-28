import { Node } from "../tree/node";
import {
  Node as DivetreeDisplayNode,
  NodeKind,
  NavNode,
  TightLeafNode,
  Split,
} from "divetree-core";

type ParentPathElement = { parent: Node<unknown>; childKey: string };

export type ParentIndex = Map<string, ParentIndexEntry>;
export type ParentIndexEntry = {
  node: Node<unknown>;
  path: ParentPathElement[];
};

export function buildParentIndex(
  root: Node<unknown>,
  result: ParentIndex = new Map(),
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

export function buildDivetreeDisplayTree(
  node: Node<unknown>,
  path: string[],
  extraDepth: number,
): DivetreeDisplayNode {
  const isOnPath = node.id === path[0];
  const isFinal = !isOnPath || !!extraDepth;

  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [100, 50],
  };
  if (isFinal) {
    if (!node.children.length) {
      return base;
    }
    return {
      kind: NodeKind.TightSplit,
      split: Split.SideBySide,
      children: [
        base,
        {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: node.children.map(
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
    children: node.children.map(c => {
      return buildDivetreeDisplayTree(
        c.node,
        isOnPath ? path.slice(1) : [],
        extraDepth + (isOnPath ? 0 : 1),
      );
    }),
  };
}

export function buildDivetreeNavTree(node: Node<unknown>): NavNode {
  return {
    id: node.id,
    children: node.children.map(c => buildDivetreeNavTree(c.node)),
  };
}
