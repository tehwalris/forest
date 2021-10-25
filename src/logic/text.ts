import {
  Doc,
  InsertState,
  ListNode,
  Node,
  NodeKind,
  TextRange,
} from "./interfaces";

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

function checkTextRangesDoNotOverlap(ranges: TextRange[]): boolean {
  const sortedRanges = [...ranges];
  sortedRanges.sort();
  return ranges.every((r, i) => i === 0 || ranges[i - 1].end <= r.pos);
}

export function getDocWithInsert(
  doc: Doc,
  insertState: Pick<InsertState, "beforePos" | "text">,
): Doc {
  return {
    root: mapNodeTextRanges(
      doc.root,
      duplicateMapPosCb((pos) =>
        pos >= insertState.beforePos ? pos + insertState.text.length : pos,
      ),
    ),
    text:
      doc.text.slice(0, insertState.beforePos) +
      insertState.text +
      doc.text.slice(insertState.beforePos),
  };
}

export function getTextWithDeletions(
  text: string,
  _deleteRanges: TextRange[],
): { text: string; mapPos: (pos: number) => number } {
  if (!_deleteRanges.length) {
    return { text, mapPos: (pos) => pos };
  }

  const deleteRanges = [..._deleteRanges];
  deleteRanges.sort();

  if (!checkTextRangesDoNotOverlap(deleteRanges)) {
    throw new Error("deleteRanges overlap");
  }

  return {
    text:
      text.slice(0, deleteRanges[0].pos) +
      deleteRanges.map((r, i) => {
        const nextPos =
          i + 1 === deleteRanges.length ? text.length : deleteRanges[i + 1].pos;
        return text.slice(r.end, nextPos);
      }),

    // Example
    // 0123456789
    //  xxx x
    //    !
    // 046789
    //  !
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
