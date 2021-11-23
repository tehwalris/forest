import { Node, NodeKind } from "../interfaces";
export function nodesAreEqualExceptRangesAndPlaceholdersAndIds(
  a: Node,
  b: Node,
  customEquality: (
    a: Node,
    b: Node,
    structKeyA: string | undefined,
    structKeyB: string | undefined,
    parentA: Node | undefined,
    parentB: Node | undefined,
  ) => boolean | undefined,
  structKeyA?: string,
  structKeyB?: string,
  parentA?: Node,
  parentB?: Node,
): boolean {
  const customEqualityResult = customEquality(
    a,
    b,
    structKeyA,
    structKeyB,
    parentA,
    parentB,
  );
  if (customEqualityResult !== undefined) {
    return customEqualityResult;
  }
  if (a.kind === NodeKind.Token && b.kind === NodeKind.Token) {
    return a.tsNode.kind === b.tsNode.kind;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    return (
      a.listKind === b.listKind &&
      a.delimiters[0] === b.delimiters[0] &&
      a.delimiters[1] === b.delimiters[1] &&
      a.content.length === b.content.length &&
      a.content.every((ca, i) =>
        nodesAreEqualExceptRangesAndPlaceholdersAndIds(
          ca,
          b.content[i],
          customEquality,
          a.structKeys?.[i],
          b.structKeys?.[i],
          a,
          b,
        ),
      ) &&
      a.equivalentToContent === b.equivalentToContent
    );
  }
  return false;
}
