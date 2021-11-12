import { EvenPathRange, Node, NodeKind, Path } from "../interfaces";
import { pathIsInRange } from "../path-utils";
import { unreachable } from "../util";

export function nodeTryGetDeepestByPath(
  node: Node,
  path: Path,
): { path: Path; node: Node } {
  if (!path.length) {
    return { path: [], node };
  }
  switch (node.kind) {
    case NodeKind.Token:
      return { path: [], node };
    case NodeKind.List: {
      const childNode = node.content[path[0]];
      if (!childNode) {
        return { path: [], node };
      }
      const childResult = nodeTryGetDeepestByPath(childNode, path.slice(1));
      return { node: childResult.node, path: [path[0], ...childResult.path] };
    }
    default:
      return unreachable(node);
  }
}

export function nodeGetByPath(node: Node, path: Path): Node | undefined {
  const result = nodeTryGetDeepestByPath(node, path);
  return result.path.length === path.length ? result.node : undefined;
}

export function nodeGetStructKeyByPath(
  node: Node,
  path: Path,
): string | undefined {
  if (path.length === 0) {
    return undefined;
  }
  const parentNode = nodeGetByPath(node, path.slice(0, -1));
  if (parentNode?.kind !== NodeKind.List || !parentNode.structKeys) {
    return undefined;
  }
  return parentNode.structKeys[path[path.length - 1]];
}

export function nodeSetByPath(node: Node, path: Path, value: Node): Node {
  if (!path.length) {
    return value;
  }
  switch (node.kind) {
    case NodeKind.Token:
      throw new Error("path too long");
    case NodeKind.List: {
      const targetIndex = path[0];
      const childNode = node.content[targetIndex];
      if (!childNode) {
        throw new Error("missing child");
      }
      const newContent = [...node.content];
      newContent[targetIndex] = nodeSetByPath(childNode, path.slice(1), value);
      if (newContent[targetIndex] === node.content[targetIndex]) {
        return node;
      }
      return { ...node, content: newContent };
    }
    default:
      return unreachable(node);
  }
}

export function nodeMapAtPath(
  path: Path,
  cb: (node: Node) => Node,
): (node: Node) => Node {
  return (node) => {
    const oldFocusedNode = nodeGetByPath(node, path);
    if (!oldFocusedNode) {
      throw new Error("node at path does not exist");
    }
    return nodeSetByPath(node, path, cb(oldFocusedNode));
  };
}

// visits parents before children
export function nodeVisitDeep(
  node: Node,
  cb: (node: Node, path: Path) => void,
  path: Path = [],
) {
  cb(node, path);
  if (node.kind === NodeKind.List) {
    for (const [i, c] of node.content.entries()) {
      nodeVisitDeep(c, cb, [...path, i]);
    }
  }
}

// maps children before parents
export function nodeMapDeep(
  oldNode: Node,
  cb: (node: Node, path: Path) => Node,
  path: Path = [],
): Node {
  let newNode = oldNode;
  if (oldNode.kind === NodeKind.List) {
    newNode = {
      ...oldNode,
      content: oldNode.content.map((c, i) => nodeMapDeep(c, cb, [...path, i])),
    };
  }
  return cb(newNode, path);
}

export function nodeVisitDeepInRange(
  rootNode: Node,
  range: EvenPathRange,
  cb: (node: Node, path: Path) => void,
) {
  nodeVisitDeep(rootNode, (node, path) => {
    if (pathIsInRange(path, range)) {
      cb(node, path);
    }
  });
}

export function onlyChildFromNode(node: Node): Node {
  if (node.kind !== NodeKind.List || node.content.length !== 1) {
    throw new Error("node must be a list with exactly 1 child");
  }
  return node.content[0];
}
