import { ListNode, Node, NodeKind } from "../tree-interfaces";
import { nodesAreEqualExceptRangesAndPlaceholders } from "./equal";

export function withCopiedPlaceholders(
  placeholderSource: ListNode,
  nodeSource: ListNode,
): ListNode;
export function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node;
export function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    !nodesAreEqualExceptRangesAndPlaceholders(placeholderSource, nodeSource)
  ) {
    throw new Error(
      "nodes do not satisfy nodesAreEqualExceptRangesAndPlaceholders",
    );
  }
  return _withCopiedPlaceholders(placeholderSource, nodeSource);
}

function _withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    placeholderSource.kind === NodeKind.Token &&
    nodeSource.kind === NodeKind.Token
  ) {
    return { ...nodeSource, isPlaceholder: placeholderSource.isPlaceholder };
  }
  if (
    placeholderSource.kind === NodeKind.List &&
    nodeSource.kind === NodeKind.List
  ) {
    return {
      ...nodeSource,
      isPlaceholder: placeholderSource.isPlaceholder,
      content: placeholderSource.content.map((placeholderSourceChild, i) =>
        _withCopiedPlaceholders(placeholderSourceChild, nodeSource.content[i]),
      ),
    };
  }
  throw new Error("unreachable");
}
