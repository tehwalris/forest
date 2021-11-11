import { sortBy } from "ramda";
import { textRangeFromFocus } from "../focus";
import { InsertState, ListNode } from "../interfaces";
import { checkTextRangesOverlap } from "../text";
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
  if (
    checkTextRangesOverlap(
      oldCursors.map((c) => textRangeFromFocus(root, c.focus)),
    )
  ) {
    console.warn("can't enter insert mode with overlapping cursors");
    return undefined;
  }

  const newCursorsWithResults = sortBy(
    (c) => c.result.beforePos,
    oldCursors.map((cursor) => ({
      cursor: adjustPostActionCursor(cursor),
      result: cursorStartInsert({ root, cursor, side }),
    })),
  );

  return {
    insertState: {
      beforePos: newCursorsWithResults.map(({ result }) => result.beforePos),
      text: "",
    },
    cursors: newCursorsWithResults.map(({ cursor }) => cursor),
  };
}
