import { Node, NodeKind } from "../interfaces";
import { StructuralSearchQuery } from "./interfaces";

function exactMatch(a: Node, b: Node): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    if (a.listKind !== b.listKind) {
      return false;
    }
    if (a.content.length !== b.content.length) {
      return false;
    }
    if (!a.content.every((ca, i) => exactMatch(ca, b.content[i]))) {
      return false;
    }
    if (a.structKeys?.length !== b.structKeys?.length) {
      return false;
    }
    if (
      a.structKeys &&
      !a.structKeys.every((ka, i) => ka === b.structKeys![i])
    ) {
      return false;
    }
  }
  if (a.tsNode?.kind !== b.tsNode?.kind) {
    return false;
  }
  return true;
}

export function makeExactMatchQuery(targetNode: Node): StructuralSearchQuery {
  return {
    match: (candidateNode) => exactMatch(candidateNode, targetNode),
  };
}
