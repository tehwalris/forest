import { last } from "ramda";
import { EvenPathRange } from "../interfaces";
import {
  groupOverlappingNonNestedRanges,
  PathRangeTree,
} from "../path-range-tree";
import {
  evenPathRangesAreEqual,
  flipEvenPathRangeForward,
} from "../path-utils";
import { groupBy, unreachable } from "../util";
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
  cursors: Cursor[];
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
  const pathRangeTree = new PathRangeTree(oldCursors.map((c) => c.focus));
  const openRanges: EvenPathRange[] = [];
  let lastEnteredRange: EvenPathRange | undefined;
  let firstExitedRange: EvenPathRange | undefined;
  let rangesWithoutChildren = new Set<EvenPathRange>();
  let rangesWithoutParents: EvenPathRange[] = [];
  pathRangeTree.traverse(
    (range) => {
      for (const openRange of openRanges) {
        rangesWithoutChildren.delete(openRange);
      }
      if (!openRanges.length) {
        rangesWithoutParents.push(range);
      }
      openRanges.push(range);
      lastEnteredRange = range;
      rangesWithoutChildren.add(range);
    },
    () => {
      const exitedRange = openRanges.pop();
      if (!exitedRange) {
        throw new Error("underflow");
      }
      if (!firstExitedRange) {
        firstExitedRange = exitedRange;
      }
    },
  );
  const selectedRanges = ((): (EvenPathRange | undefined)[] => {
    switch (side) {
      case CursorReduceAcrossSide.First:
        return [firstExitedRange];
      case CursorReduceAcrossSide.Last:
        return [lastEnteredRange];
      case CursorReduceAcrossSide.Inner:
        return [...rangesWithoutChildren.values()];
      case CursorReduceAcrossSide.Outer:
        return rangesWithoutParents;
      default:
        return unreachable(side);
    }
  })();
  const selectedCursors = oldCursors.filter((c) =>
    selectedRanges.some((r) => r && evenPathRangesAreEqual(c.focus, r)),
  );
  if (!selectedCursors.length) {
    throw new Error("no cursors remaining");
  }
  return { cursors: selectedCursors };
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
      .flatMap((g) => cursorReduceAcross({ cursors: g, side }).cursors)
      .map((c) =>
        adjustPostActionCursor(
          c,
          { parentPath: c.parentPath.slice(0, -1) },
          undefined,
        ),
      ),
  };
}
