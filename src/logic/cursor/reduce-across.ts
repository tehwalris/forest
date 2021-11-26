import { last } from "ramda";
import { groupBy } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
export enum CursorReduceAcrossSide {
  First,
  Last,
  Inner,
  Outer,
}
interface CursorReduceAcrossArgs {
  cursors: Cursor[];
  side: CursorReduceAcrossSide;
}
interface CursorReduceAcrossResult {
  cursor: Cursor;
}
export function cursorReduceAcross({
  cursors: oldCursors,
  side,
}: CursorReduceAcrossArgs): CursorReduceAcrossResult {
  if (!oldCursors.length) {
    throw new Error("no cursors");
  }
  if (side !== CursorReduceAcrossSide.First) {
    throw new Error("not implemented");
  }
  return { cursor: oldCursors[0] };
}
interface MultiCursorReduceAcrossArgs {
  cursors: Cursor[];
  side: CursorReduceAcrossSide;
}
interface MultiCursorReduceAcrossResult {
  cursors: Cursor[];
}
export function multiCursorReduceAcross({
  cursors: oldCursors,
  side,
}: MultiCursorReduceAcrossArgs): MultiCursorReduceAcrossResult {
  let groups: Cursor[][];
  while (true) {
    groups = [...groupBy(oldCursors, (c) => last(c.parentPath)).values()];
    if (groups.some((g) => g.length !== 1)) {
      break;
    }
    if (oldCursors.every((c) => !c.parentPath.length)) {
      return {
        cursors: oldCursors.map((c) =>
          adjustPostActionCursor(c, {}, undefined),
        ),
      };
    }
    oldCursors = oldCursors.map((c) => ({
      ...c,
      parentPath: c.parentPath.slice(0, -1),
    }));
  }
  return {
    cursors: groups
      .map((g) => cursorReduceAcross({ cursors: g, side }).cursor)
      .map((c) =>
        adjustPostActionCursor(
          c,
          { parentPath: c.parentPath.slice(0, -1) },
          undefined,
        ),
      ),
  };
}
