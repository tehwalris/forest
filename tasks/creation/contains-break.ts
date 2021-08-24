// src/logic/tree/display-line.ts

type Doc = any;
var DocKind, LineKind, unreachable: any;

export function containsBreak(doc: Doc): boolean {
  if (Array.isArray(doc)) {
    return doc.some((c) => containsBreak(c));
  }
  switch (doc.kind) {
    case DocKind.Nest: {
      return containsBreak(doc.content);
    }
    case DocKind.Leaf:
      return false;
    case DocKind.Line:
      return doc.lineKind === LineKind.Hard;
    case DocKind.Group:
      return doc.break;
    default:
      unreachable(doc);
  }
}
