import { isFocusOnEmptyListContent, normalizeFocusIn } from "../focus";
import { EvenPathRange, ListNode, NodeKind, Path } from "../interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqualIgnoringDirection,
  flipEvenPathRangeForward,
  getPathToTip,
} from "../path-utils";
import { nodeGetByPath } from "../tree-utils/access";
import { unreachable } from "../util";
import { Cursor } from "./interfaces";

export enum CursorReduceSelectionSide {
  First,
  Last,
  JustExtended,
}

interface CursorReduceSelectionArgs {
  root: ListNode;
  cursor: Cursor;
  side: CursorReduceSelectionSide;
}

interface CursorReduceSelectionResult {
  cursor: Cursor;
  didReduce: boolean;
}

export function cursorReduceSelection({
  root,
  cursor: oldCursor,
  side,
}: CursorReduceSelectionArgs): CursorReduceSelectionResult {
  if (
    (side === CursorReduceSelectionSide.JustExtended &&
      !oldCursor.enableReduceToTip) ||
    isFocusOnEmptyListContent(root, oldCursor.focus)
  ) {
    return {
      cursor: { focus: oldCursor.focus, enableReduceToTip: false },
      didReduce: false,
    };
  }

  let target: Path;
  switch (side) {
    case CursorReduceSelectionSide.First:
      target = getFocusSkippingDelimitedLists(root, oldCursor.focus).anchor;
      break;
    case CursorReduceSelectionSide.Last:
      target = getPathToTip(
        getFocusSkippingDelimitedLists(root, oldCursor.focus),
      );
      break;
    case CursorReduceSelectionSide.JustExtended:
      target = getPathToTip(oldCursor.focus);
      break;
    default:
      return unreachable(side);
  }

  if (!nodeGetByPath(root, target)) {
    return {
      cursor: { focus: oldCursor.focus, enableReduceToTip: false },
      didReduce: false,
    };
  }

  let focus: EvenPathRange = { anchor: target, offset: 0 };
  focus = asEvenPathRange(normalizeFocusIn(root, asUnevenPathRange(focus)));

  return {
    cursor: { focus, enableReduceToTip: false },
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
  }
  return focus;
}
