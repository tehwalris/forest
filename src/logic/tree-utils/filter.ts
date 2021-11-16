import { ListNode, Node, NodeKind, Path } from "../interfaces";
import { PathMapper } from "../path-mapper";
export function filterNodes(
  node: ListNode,
  shouldKeep: (node: Node) => boolean,
): {
  node: ListNode;
  pathMapper: PathMapper;
};
export function filterNodes(
  node: Node,
  shouldKeep: (node: Node) => boolean,
): {
  node: Node;
  pathMapper: PathMapper;
};
export function filterNodes(
  node: Node,
  shouldKeep: (node: Node) => boolean,
): {
  node: Node;
  pathMapper: PathMapper;
} {
  const pathMapper = new PathMapper([]);
  return {
    node: _filterNodes({
      node,
      shouldKeep,
      pathMapper,
      oldPath: [],
      newPath: [],
    }),
    pathMapper,
  };
}
function _filterNodes({
  node,
  shouldKeep,
  pathMapper,
  oldPath,
  newPath,
}: {
  node: Node;
  shouldKeep: (node: Node) => boolean;
  pathMapper: PathMapper;
  oldPath: Path;
  newPath: Path;
}): Node {
  if (!shouldKeep(node)) {
    throw new Error("node outside of list can't be removed");
  }
  if (node.kind === NodeKind.List) {
    const stuff = node.content.map((c, i) => ({
      c,
      oldI: i,
      newI: i,
      keep: shouldKeep(c),
    }));
    if (!stuff.every(({ keep }) => keep)) {
      let i = 0;
      for (const entry of stuff) {
        entry.newI = i;
        pathMapper.record({
          old: [...oldPath, entry.oldI],
          new: [...newPath, entry.newI],
        });
        if (entry.keep) {
          i++;
        }
      }
    }
    return {
      ...node,
      content: stuff
        .filter(({ keep }) => keep)
        .map(({ c, oldI, newI }) =>
          _filterNodes({
            node: c,
            shouldKeep,
            pathMapper,
            oldPath: [...oldPath, oldI],
            newPath: [...newPath, newI],
          }),
        ),
      structKeys: node.structKeys?.filter((_k, i) => stuff[i].keep),
    };
  }
  return node;
}
