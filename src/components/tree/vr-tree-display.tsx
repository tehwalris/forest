import * as React from "react";
import SurroundTrees from "./surround-trees";
import {
  DisplayNode,
  DisplayPath,
  nodesFromDisplayNode,
} from "../../logic/tree/display";
import { ShallowTree } from "./shallow-tree";

interface Props {
  root: DisplayNode;
  highlightPath: DisplayPath;
  radius: number;
}

function getDeepestPossibleByDisplayPath(
  path: DisplayPath,
  parent: DisplayNode,
): DisplayNode {
  if (path.length) {
    const childNode = parent.children[path[0]];
    if (childNode) {
      return getDeepestPossibleByDisplayPath(path.slice(1), childNode);
    }
  }
  return parent;
}

function labelDisplayNode(node: DisplayNode): string {
  const fullChain = nodesFromDisplayNode(node);
  const debugLabel = fullChain.reduce(
    (a, c) => c.node.getDebugLabel() || a,
    "",
  );
  const built = node.baseNode.build();
  const path = fullChain[fullChain.length - 1].path
    .slice(Math.max(0, node.basePath.length - 1))
    .join("/");
  const label =
    (debugLabel ? `${path}\n${debugLabel}` : path) + (built.ok ? "" : "!");
  return label;
}

function childrenToShallowTrees(node: DisplayNode): ShallowTree[] {
  return node.children.map(p => ({
    root: { label: labelDisplayNode(p) },
    children: p.children.map(c => ({ label: labelDisplayNode(c) })),
  }));
}

export default ({ root, highlightPath, radius }: Props) => {
  const target = getDeepestPossibleByDisplayPath(highlightPath, root);
  const trees = childrenToShallowTrees(target);
  return <SurroundTrees trees={trees} radius={radius} />;
};
