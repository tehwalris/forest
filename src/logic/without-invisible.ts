import { ListNode, Node, NodeKind } from "./interfaces";
import { nodeMapDeep } from "./tree-utils/access";

export function withoutInvisibleNodes(oldRoot: ListNode): ListNode {
  const newRoot = nodeMapDeep(oldRoot, (oldNode): Node => {
    if (oldNode.kind === NodeKind.Token) {
      return oldNode;
    }
    const keepMask = oldNode.content.map(
      (c) =>
        c.kind === NodeKind.Token ||
        !c.equivalentToContent ||
        !!c.content.length,
    );
    if (keepMask.every((v) => v)) {
      return oldNode;
    }
    return {
      ...oldNode,
      content: oldNode.content.filter((_c, i) => keepMask[i]),
      structKeys: oldNode.structKeys?.filter((_k, i) => keepMask[i]),
    };
  });
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("unreachable");
  }
  return newRoot;
}
