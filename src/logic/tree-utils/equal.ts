import { Node, NodeKind } from "../interfaces";

export function nodesAreEqualExceptRangesAndPlaceholdersAndIds(
  a: Node,
  b: Node,
): boolean {
  if (a.kind === NodeKind.Token && b.kind === NodeKind.Token) {
    // TODO check that the tsNodes have equal content
    return a.tsNode.kind === b.tsNode.kind;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    // TODO check structKeys
    return (
      a.listKind === b.listKind &&
      a.delimiters[0] === b.delimiters[0] &&
      a.delimiters[1] === b.delimiters[1] &&
      a.content.length === b.content.length &&
      a.content.every((ca, i) =>
        nodesAreEqualExceptRangesAndPlaceholdersAndIds(ca, b.content[i]),
      ) &&
      a.equivalentToContent === b.equivalentToContent
    );
  }
  return false;
}
