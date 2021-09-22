import { Node, NodeKind } from "../tree-interfaces";

export function nodesAreEqualExceptRangesAndPlaceholders(
  a: Node,
  b: Node,
): boolean {
  if (a.kind === NodeKind.Token && b.kind === NodeKind.Token) {
    // TODO check that the tsNodes have equal content
    return a.tsNode.kind === b.tsNode.kind;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    return (
      a.listKind === b.listKind &&
      a.delimiters[0] === b.delimiters[0] &&
      a.delimiters[1] === b.delimiters[1] &&
      a.content.length === b.content.length &&
      a.content.every((ca, i) =>
        nodesAreEqualExceptRangesAndPlaceholders(ca, b.content[i]),
      ) &&
      a.equivalentToContent === b.equivalentToContent
    );
  }
  return false;
}
