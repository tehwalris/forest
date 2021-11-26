import { last } from "ramda";
import { hasOverlappingNonNestedRanges } from "../path-range-tree";
import { flipEvenPathRangeForward } from "../path-utils";
import { groupBy } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
export enum CursorReduceAcrossSide {
  First,
  Last,
  Inner,
  Outer,
  FixOverlap,
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
  if (side === CursorReduceAcrossSide.FixOverlap) {
    return { cursor: oldCursors[0] };
  }
  // TODO
  return { cursor: last(oldCursors)! };
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
  const failResult: MultiCursorReduceAcrossResult = {
    cursors: oldCursors.map((c) => adjustPostActionCursor(c, {}, undefined)),
  };
  let cursors = oldCursors.map((c) =>
    adjustPostActionCursor(
      c,
      { enableReduceToTip: false, focus: flipEvenPathRangeForward(c.focus) },
      undefined,
    ),
  );
  let groups: Cursor[][];
  while (true) {
    groups = [...groupBy(cursors, (c) => last(c.parentPath)).values()];
    if (groups.some((g) => g.length !== 1)) {
      break;
    }
    if (cursors.every((c) => !c.parentPath.length)) {
      return failResult;
    }
    cursors = cursors.map((c) => ({
      ...c,
      parentPath: c.parentPath.slice(0, -1),
    }));
  }
  if (side !== CursorReduceAcrossSide.FixOverlap) {
    for (const g of groups) {
      if (hasOverlappingNonNestedRanges(g.map((c) => c.focus))) {
        console.warn(
          "can't reduce across cursors because some cursors have overlapping non-nested ranges",
        );
        return failResult;
      }
    }
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
