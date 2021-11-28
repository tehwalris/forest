import { isFocusOnEmptyListContent, normalizeFocusIn } from "../focus";
import { EvenPathRange, ListNode, NodeKind, Path } from "../interfaces";
import {
  evenPathRangesAreEqualIgnoringDirection,
  flipEvenPathRangeForward,
  getPathToTip,
} from "../path-utils";
import { nodeGetByPath } from "../tree-utils/access";
import { unreachable } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
export enum CursorReduceWithinSide {
  First,
  Last,
  JustExtended,
}
interface CursorReduceWithinArgs {
  root: ListNode;
  cursor: Cursor;
  side: CursorReduceWithinSide;
}
interface CursorReduceWithinResult {
  cursor: Cursor;
  didReduce: boolean;
}
function cursorReduceWithin({
  root,
  cursor: oldCursor,
  side,
}: CursorReduceWithinArgs): CursorReduceWithinResult {
  if (
    (side === CursorReduceWithinSide.JustExtended &&
      !oldCursor.enableReduceToTip) ||
    isFocusOnEmptyListContent(root, oldCursor.focus)
  ) {
    return {
      cursor: adjustPostActionCursor(
        oldCursor,
        { focus: oldCursor.focus },
        undefined,
      ),
      didReduce: false,
    };
  }
  let target: Path;
  switch (side) {
    case CursorReduceWithinSide.First:
      target = getFocusSkippingDelimitedLists(root, oldCursor.focus).anchor;
      break;
    case CursorReduceWithinSide.Last:
      target = getPathToTip(
        getFocusSkippingDelimitedLists(root, oldCursor.focus),
      );
      break;
    case CursorReduceWithinSide.JustExtended:
      target = getPathToTip(oldCursor.focus);
      break;
    default:
      return unreachable(side);
  }
  if (!nodeGetByPath(root, target)) {
    return {
      cursor: adjustPostActionCursor(
        oldCursor,
        { focus: oldCursor.focus },
        undefined,
      ),
      didReduce: false,
    };
  }
  let focus: EvenPathRange = { anchor: target, offset: 0 };
  focus = normalizeFocusIn(root, focus);
  return {
    cursor: adjustPostActionCursor(oldCursor, { focus }, undefined),
    didReduce: !evenPathRangesAreEqualIgnoringDirection(focus, oldCursor.focus),
  };
}
function getFocusSkippingDelimitedLists(
  root: ListNode,
  focus: EvenPathRange,
): EvenPathRange {
  focus = flipEvenPathRangeForward(focus);
  while (!focus.offset) {
    const focusedNode = nodeGetByPath(root, focus.anchor);
    if (!focusedNode) {
      throw new Error("invalid focus");
    }
    if (focusedNode.kind !== NodeKind.List) {
      break;
    }
    focus = {
      anchor: [...focus.anchor, 0],
      offset: focusedNode.content.length - 1,
    };
    if (!focusedNode.equivalentToContent) {
      return focus;
    }
  }
  return focus;
}
interface MultiCursorReduceWithinArgs
  extends Omit<CursorReduceWithinArgs, "cursor"> {
  cursors: Cursor[];
  strict: boolean;
}
interface MultiCursorReduceWithinResult {
  cursors: Cursor[];
  failMask?: boolean[];
}
export function multiCursorReduceWithin({
  cursors: oldCursors,
  strict,
  ...restArgs
}: MultiCursorReduceWithinArgs): MultiCursorReduceWithinResult {
  const results = oldCursors.map((cursor) =>
    cursorReduceWithin({
      ...restArgs,
      cursor: cursor,
    }),
  );
  return {
    cursors: results.map((r) => r.cursor),
    failMask: strict ? results.map((r) => !r.didReduce) : undefined,
  };
}
