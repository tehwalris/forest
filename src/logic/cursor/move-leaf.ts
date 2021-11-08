import { untilEvenFocusChanges } from "../focus";
import { Doc, ListNode, NodeKind, UnevenPathRange } from "../interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqualIgnoringDirection,
  flipEvenPathRangeBackward,
  flipEvenPathRangeForward,
  pathsAreEqual,
} from "../path-utils";
import { nodeGetByPath } from "../tree-utils/access";
import { Cursor } from "./interfaces";

interface CursorMoveLeafArgs {
  doc: Doc;
  cursor: Cursor;
  direction: -1 | 1;
}

interface CursorMoveLeafResult {
  cursor: Cursor;
  didMove: boolean;
  didMoveAcrossLists: boolean;
}

export function cursorMoveLeaf({
  doc,
  cursor: oldCursor,
  direction,
}: CursorMoveLeafArgs): CursorMoveLeafResult {
  let focus = oldCursor.focus;

  if (direction === 1) {
    focus = flipEvenPathRangeBackward(focus);
  } else {
    focus = flipEvenPathRangeForward(focus);
  }

  focus = asEvenPathRange(
    untilEvenFocusChanges(asUnevenPathRange(focus), (focus) =>
      tryMoveThroughLeavesOnce(doc.root, focus, direction, false),
    ),
  );

  return {
    cursor: { ...oldCursor, focus },
    didMove: !evenPathRangesAreEqualIgnoringDirection(focus, oldCursor.focus),
    // TODO not sure if didMoveAcrossLists is correct
    didMoveAcrossLists: !pathsAreEqual(focus.anchor, oldCursor.focus.anchor),
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
