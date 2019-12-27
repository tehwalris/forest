import { Node } from "../tree/node";
import { Node as DivetreeDisplayNode, NodeKind, NavNode } from "divetree-core";

export function buildNodeIndex(
  root: Node<unknown>,
  result: Map<string, Node<unknown>> = new Map(),
): Map<string, Node<unknown>> {
  result.set(root.id, root);
  root.children.forEach(c => buildNodeIndex(c.node, result));
  return result;
}

type ParentIndex = Map<string, { parent: Node<unknown>; childKey: string }>;

export function buildParentIndex(
  root: Node<unknown>,
  result: ParentIndex = new Map(),
  parent?: Node<unknown>,
): ParentIndex {
  if (parent) {
    const child = parent.children.find(c => c.node === root);
    if (!child) {
      throw new Error("expected child to be contained in parent");
    }
    result.set(root.id, { parent, childKey: child.key });
  }
  root.children.forEach(c => buildParentIndex(c.node, result, root));
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
