import { normalizeFocusIn, untilEvenFocusChanges } from "../focus";
import { ListNode, NodeKind, UnevenPathRange } from "../interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqualIgnoringDirection,
  flipEvenPathRangeBackward,
  flipEvenPathRangeForward,
} from "../path-utils";
import { nodeGetByPath } from "../tree-utils/access";
import { Cursor } from "./interfaces";

interface CursorMoveLeafArgs {
  root: ListNode;
  cursor: Cursor;
  direction: -1 | 1;
  extend: boolean;
}

interface CursorMoveLeafResult {
  cursor: Cursor;
  didMove: boolean;
}

export function cursorMoveLeaf({
  root,
  cursor: oldCursor,
  direction,
  extend,
}: CursorMoveLeafArgs): CursorMoveLeafResult {
  let focus = oldCursor.focus;

  if (direction === 1) {
    focus = flipEvenPathRangeForward(focus);
  } else {
    focus = flipEvenPathRangeBackward(focus);
  }

  focus = asEvenPathRange(
    untilEvenFocusChanges(asUnevenPathRange(focus), (focus) =>
      tryMoveThroughLeavesOnce(root, focus, direction, extend),
    ),
  );
  focus = asEvenPathRange(normalizeFocusIn(root, asUnevenPathRange(focus)));

  return {
    cursor: { ...oldCursor, focus },
    didMove: !evenPathRangesAreEqualIgnoringDirection(focus, oldCursor.focus),
  };
}

function tryMoveThroughLeavesOnce(
  root: ListNode,
  focus: UnevenPathRange,
  direction: -1 | 1,
  extend: boolean,
): UnevenPathRange {
  let currentPath = [...focus.tip];
  while (true) {
    if (!currentPath.length) {
      return focus;
    }
    const siblingPath = [...currentPath];
    siblingPath[siblingPath.length - 1] += direction;
    if (nodeGetByPath(root, siblingPath)) {
      currentPath = siblingPath;
      break;
    }
    currentPath.pop();
  }

  while (true) {
    const currentNode = nodeGetByPath(root, currentPath)!;
    if (currentNode.kind !== NodeKind.List || !currentNode.content.length) {
      break;
    }
    const childPath = [
      ...currentPath,
      direction === -1 ? currentNode.content.length - 1 : 0,
    ];
    if (!nodeGetByPath(root, childPath)) {
      break;
    }
    currentPath = childPath;
  }

  return extend
    ? { anchor: focus.anchor, tip: currentPath }
    : { anchor: currentPath, tip: currentPath };
}
