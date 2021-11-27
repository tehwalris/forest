import { sortBy } from "ramda";
import { textRangeFromFocus } from "../focus";
import { InsertState, ListNode } from "../interfaces";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
export enum CursorStartInsertSide {
  Before,
  After,
}
interface CursorStartInsertArgs {
  root: ListNode;
  cursor: Cursor;
  side: CursorStartInsertSide;
}
interface CursorStartInsertResult {
  beforePos: number;
}
function cursorStartInsert({
  root,
  cursor: oldCursor,
  side,
}: CursorStartInsertArgs): CursorStartInsertResult {
  const range = textRangeFromFocus(root, oldCursor.focus);
  return {
    beforePos: range[side === CursorStartInsertSide.Before ? "pos" : "end"],
  };
}
interface MultiCursorStartInsertArgs {
  root: ListNode;
  cursors: Cursor[];
  side: CursorStartInsertSide;
}
interface MultiCursorStartInsertResult {
  insertState: InsertState;
  cursors: Cursor[];
}
export function multiCursorStartInsert({
  root,
  cursors: oldCursors,
  side,
}: MultiCursorStartInsertArgs): MultiCursorStartInsertResult | undefined {
  const newCursorsWithResults = sortBy(
    (c) => c.result.beforePos,
    oldCursors.map((cursor) => ({
      cursor: adjustPostActionCursor(cursor, {}, undefined),
      result: cursorStartInsert({ root, cursor, side }),
    })),
  );
  const seenPositionCount = new Map<number, number>();
  const duplicateIndices: number[] = [];
  for (const {
    result: { beforePos },
  } of newCursorsWithResults) {
    const count = seenPositionCount.get(beforePos) || 0;
    duplicateIndices.push(count);
    seenPositionCount.set(beforePos, count + 1);
  }
  return {
    insertState: {
      beforePos: newCursorsWithResults.map(({ result }) => result.beforePos),
      duplicateIndices,
      text: "",
    },
    cursors: newCursorsWithResults.map(({ cursor }) => cursor),
  };
}
