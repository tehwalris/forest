import { prefixNodesWithPaths } from "../path-utils";
import { ListNode, Node, NodeKind, NodeWithPath, Path } from "../interfaces";
import { nodeGetByPath, nodeMapAtPath } from "../tree-utils/access";

function flattenNode(node: Node): NodeWithPath[] {
  if (node.kind === NodeKind.Token || !node.equivalentToContent) {
    return [{ node, path: [] }];
  }
  return node.content.flatMap((c, i) =>
    prefixNodesWithPaths(flattenNode(c), i),
  );
}

export function flattenNodeAroundSplit(
  node: Node,
  splitBeforePath: Path,
): { before: NodeWithPath[]; after: NodeWithPath[] } {
  if (!splitBeforePath.length || node.kind === NodeKind.Token) {
    return { before: [], after: flattenNode(node) };
  }
  const before = node.content
    .slice(0, splitBeforePath[0])
    .flatMap((c, i) => prefixNodesWithPaths(flattenNode(c), i));
  const nodeAt = node.content[splitBeforePath[0]] as Node | undefined;
  const prefixRecursion = ({
    before,
    after,
  }: ReturnType<typeof flattenNodeAroundSplit>) => ({
    before: prefixNodesWithPaths(before, splitBeforePath[0]),
    after: prefixNodesWithPaths(after, splitBeforePath[0]),
  });
  const at =
    nodeAt &&
    prefixRecursion(flattenNodeAroundSplit(nodeAt, splitBeforePath.slice(1)));
  const after = node.content
    .slice(splitBeforePath[0] + 1)
    .flatMap((c, i) =>
      prefixNodesWithPaths(flattenNode(c), splitBeforePath[0] + 1 + i),
    );
  return {
    before: [...before, ...(at?.before || [])],
    after: [...(at?.after || []), ...after],
  };
}

// path must point *inside* the list, not just at it
function getPathToDeepestDelimitedListOrRoot(root: ListNode, path: Path): Path {
  return _getPathToDeepestDelimitedList(root, path) || [];
}

function _getPathToDeepestDelimitedList(
  node: ListNode,
  path: Path,
): Path | undefined {
  if (!path.length) {
    return undefined;
  }

  let deeperPathSuffix: Path | undefined;
  const child = node.content[path[0]];
  if (child?.kind === NodeKind.List) {
    deeperPathSuffix = _getPathToDeepestDelimitedList(child, path.slice(1));
  }

  const pathIfDelimited = node.equivalentToContent ? undefined : [];
  return deeperPathSuffix ? [path[0], ...deeperPathSuffix] : pathIfDelimited;
}

export function splitAtDeepestDelimiter(
  root: ListNode,
  targetPath: Path,
): {
  withEmptyList: ListNode;
  list: ListNode;
  pathToList: Path;
  pathFromList: Path;
} {
  const delimitedPath = getPathToDeepestDelimitedListOrRoot(root, targetPath);
  return {
    withEmptyList: nodeMapAtPath(delimitedPath, (node) => {
      if (node.kind !== NodeKind.List) {
        throw new Error("node is not a list");
      }
      return { ...node, content: [] };
    })(root) as ListNode,
    list: nodeGetByPath(root, delimitedPath) as ListNode,
    pathToList: delimitedPath,
    pathFromList: targetPath.slice(delimitedPath.length),
  };
}
