import { last } from "ramda";
import { groupOverlappingNonNestedRanges } from "../path-range-tree";
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
    throw new Error(
      "CursorReduceAcrossSide.FixOverlap should be handled by multi cursor",
    );
  }
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
  const overlapGroups = groupOverlappingNonNestedRanges(
    cursors.map((c) => c.focus),
  );
  if (side === CursorReduceAcrossSide.FixOverlap) {
    return { cursors: overlapGroups.map((g) => cursors[g[0]]) };
  }
  if (overlapGroups.some((g) => g.length > 1)) {
    console.warn(
      "can't reduce across cursors because some cursors have overlapping non-nested ranges",
    );
    return failResult;
  }
  let parentGroups: Cursor[][];
  while (true) {
    parentGroups = [...groupBy(cursors, (c) => last(c.parentPath)).values()];
    if (parentGroups.some((g) => g.length !== 1)) {
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
  return {
    cursors: parentGroups
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
