import { ListNode, NodeKind, UnevenPathRange } from "./interfaces";
import {
  asEvenPathRange,
  evenPathRangesAreEqual,
  unevenPathRangesAreEqual,
} from "./path-utils";
import { nodeGetByPath } from "./tree-utils/access";

export function normalizeFocusInOnce(
  root: ListNode,
  focus: UnevenPathRange,
): UnevenPathRange {
  const evenFocus = asEvenPathRange(focus);
  if (evenFocus.offset !== 0) {
    return focus;
  }
  const focusedNode = nodeGetByPath(root, evenFocus.anchor);
  if (!focusedNode) {
    throw new Error("invalid focus");
  }
  if (
    focusedNode.kind !== NodeKind.List ||
    !focusedNode.equivalentToContent ||
    !focusedNode.content.length
  ) {
    return focus;
  }
  return {
    anchor: [...evenFocus.anchor, 0],
    tip: [...evenFocus.anchor, focusedNode.content.length - 1],
  };
}

export function whileUnevenFocusChanges(
  initialFocus: UnevenPathRange,
  cb: (focus: UnevenPathRange) => UnevenPathRange,
): UnevenPathRange {
  let oldFocus = initialFocus;
  while (true) {
    const newFocus = cb(oldFocus);
    if (unevenPathRangesAreEqual(newFocus, oldFocus)) {
      return newFocus;
    }
    oldFocus = newFocus;
  }
}

export function untilEvenFocusChanges(
  initialFocus: UnevenPathRange,
  cb: (focus: UnevenPathRange) => UnevenPathRange,
): UnevenPathRange {
  let oldFocus = initialFocus;
  while (true) {
    const newFocus = cb(oldFocus);
    if (unevenPathRangesAreEqual(newFocus, oldFocus)) {
      // avoid infinite loop (if the uneven focus didn't change, it probably never will, so the even focus wont either)
      return newFocus;
    }
    if (
      !evenPathRangesAreEqual(
        asEvenPathRange(newFocus),
        asEvenPathRange(oldFocus),
      )
    ) {
      return newFocus;
    }
    oldFocus = newFocus;
  }
}

export function tryMoveThroughLeavesOnce(
  root: ListNode,
  focus: UnevenPathRange,
  offset: -1 | 1,
  extend: boolean,
): UnevenPathRange {
  let currentPath = [...focus.tip];
  while (true) {
    if (!currentPath.length) {
      return focus;
    }
    const siblingPath = [...currentPath];
    siblingPath[siblingPath.length - 1] += offset;
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
      offset === -1 ? currentNode.content.length - 1 : 0,
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
