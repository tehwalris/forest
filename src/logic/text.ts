import { sortBy } from "ramda";
import { Doc, ListNode, Node, NodeKind, TextRange } from "./interfaces";
import { assertSortedBy, unreachable } from "./util";
export interface Insertion {
  beforePos: number;
  text: string;
}
export enum InsertionOrDeletionKind {
  Insertion,
  Deletion,
}
export type InsertionOrDeletion =
  | {
      kind: InsertionOrDeletionKind.Insertion;
      insertion: Insertion;
    }
  | {
      kind: InsertionOrDeletionKind.Deletion;
      textRange: TextRange;
    };
export function duplicateMapPosCb(
  cb: (pos: number) => number,
): (pos: number, end: number) => [number, number] {
  return (pos, end) => [cb(pos), cb(end)];
}
export function mapNodeTextRanges(
  node: ListNode,
  cb: (pos: number, end: number) => [number, number],
): ListNode;
export function mapNodeTextRanges(
  node: Node,
  cb: (pos: number, end: number) => [number, number],
): Node;
export function mapNodeTextRanges(
  node: Node,
  cb: (pos: number, end: number) => [number, number],
): Node {
  const [pos, end] = cb(node.pos, node.end);
  node = { ...node, pos, end };
  if (node.kind === NodeKind.List) {
    node.content = node.content.map((c) => mapNodeTextRanges(c, cb));
  }
  return node;
}
export function checkTextRangesOverlap(ranges: TextRange[]): boolean {
  const sortedRanges = [...ranges];
  sortedRanges.sort();
  return !ranges.every((r, i) => i === 0 || ranges[i - 1].end <= r.pos);
}
export function makeNewPosFromOldPosForInsertions(
  insertions: Insertion[],
): (oldPos: number) => number {
  assertSortedBy(insertions, (insertion) => insertion.beforePos);
  return (oldPos: number): number => {
    let totalInsertionLengthBefore = 0;
    for (const insertion of insertions) {
      if (insertion.beforePos > oldPos) {
        break;
      }
      totalInsertionLengthBefore += insertion.text.length;
    }
    return oldPos + totalInsertionLengthBefore;
  };
}
export function getDocWithInsertions(doc: Doc, insertions: Insertion[]): Doc {
  assertSortedBy(insertions, (insertion) => insertion.beforePos);
  const textParts = [];
  {
    let pos = 0;
    for (const insertion of insertions) {
      textParts.push(doc.text.slice(pos, insertion.beforePos), insertion.text);
      pos = insertion.beforePos;
    }
    if (pos < doc.text.length) {
      textParts.push(doc.text.slice(pos, doc.text.length));
    }
  }
  return {
    root: mapNodeTextRanges(
      doc.root,
      duplicateMapPosCb(makeNewPosFromOldPosForInsertions(insertions)),
    ),
    text: textParts.join(""),
  };
}
export function getTextWithDeletions(
  text: string,
  _deleteRanges: TextRange[],
): {
  text: string;
  mapPos: (pos: number) => number;
} {
  if (!_deleteRanges.length) {
    return { text, mapPos: (pos) => pos };
  }
  const deleteRanges = sortBy((r) => r.pos, _deleteRanges);
  if (checkTextRangesOverlap(deleteRanges)) {
    throw new Error("deleteRanges overlap");
  }
  return {
    text: [
      text.slice(0, deleteRanges[0].pos),
      ...deleteRanges.map((r, i) => {
        const nextPos =
          i + 1 === deleteRanges.length ? text.length : deleteRanges[i + 1].pos;
        return text.slice(r.end, nextPos);
      }),
    ].join(""),
    mapPos: (pos) => {
      const containingRange = deleteRanges.find(
        (r) => r.pos <= pos && r.end > pos,
      );
      if (containingRange) {
        pos = containingRange.end;
      }
      const rangesBefore = deleteRanges.filter((r) => r.end <= pos);
      const deletedCharsBefore = rangesBefore.reduce(
        (a, c) => a + (c.end - c.pos),
        0,
      );
      return pos - deletedCharsBefore;
    },
  };
}
export function getTextWithInsertionsAndDeletions(
  oldText: string,
  _operations: InsertionOrDeletion[],
): string {
  const operations = sortBy(
    (o) =>
      o.kind === InsertionOrDeletionKind.Insertion
        ? o.insertion.beforePos - 0.5
        : o.textRange.pos,
    _operations,
  );
  const textParts = [];
  let pos = 0;
  for (const o of operations) {
    if (o.kind === InsertionOrDeletionKind.Insertion) {
      if (pos > o.insertion.beforePos) {
        throw new Error("overlapping operations");
      }
      textParts.push(
        oldText.slice(pos, o.insertion.beforePos),
        o.insertion.text,
      );
      pos = o.insertion.beforePos;
    } else if (o.kind === InsertionOrDeletionKind.Deletion) {
      if (pos > o.textRange.pos) {
        throw new Error("overlapping operations");
      }
      textParts.push(oldText.slice(pos, o.textRange.pos));
      pos = o.textRange.end;
    } else {
      return unreachable(o);
    }
  }
  if (pos < oldText.length) {
    textParts.push(oldText.slice(pos, oldText.length));
  }
  return textParts.join("");
}
