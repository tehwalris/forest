import { Node } from "../tree/node";
import { Node as DivetreeDisplayNode, NodeKind, NavNode } from "divetree-core";

type ParentPathElement = { parent: Node<unknown>; childKey: string };

export type ParentIndex = Map<
  string,
  { node: Node<unknown>; path: ParentPathElement[] }
>;

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
): DivetreeDisplayNode {
  return {
    kind: NodeKind.Loose,
    id: node.id + "-loose", // HACK This suffix wont work if "id" is an arbitrary string
    parent: {
      kind: NodeKind.TightLeaf,
      id: node.id,
      size: [120, 35],
    },
    children: node.children.map(c => buildDivetreeDisplayTree(c.node)),
  };
}

export function buildDivetreeNavTree(node: Node<unknown>): NavNode {
  return {
    id: node.id,
    children: node.children.map(c => buildDivetreeNavTree(c.node)),
  };
}
