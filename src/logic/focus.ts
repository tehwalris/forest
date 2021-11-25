import {
  EvenPathRange,
  ListNode,
  NodeKind,
  Path,
  TextRange,
  UnevenPathRange,
} from "./interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqual,
  flipEvenPathRangeForward,
  getPathToTip,
  unevenPathRangesAreEqual,
  uniqueByPath,
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
export function normalizeFocusIn(
  root: ListNode,
  focus: EvenPathRange,
): EvenPathRange {
  if (isFocusOnEmptyListContent(root, focus)) {
    return focus;
  }
  return asEvenPathRange(
    whileUnevenFocusChanges(asUnevenPathRange(focus), (focus) =>
      normalizeFocusInOnce(root, focus),
    ),
  );
}
export function normalizeFocusOutOnce(
  root: ListNode,
  focus: UnevenPathRange,
): UnevenPathRange {
  const evenFocus = asEvenPathRange(focus);
  if (!evenFocus.anchor.length) {
    return focus;
  }
  const parentFocus: EvenPathRange = {
    anchor: evenFocus.anchor.slice(0, -1),
    offset: 0,
  };
  if (
    evenPathRangesAreEqual(
      flipEvenPathRangeForward(
        asEvenPathRange(
          normalizeFocusInOnce(root, asUnevenPathRange(parentFocus)),
        ),
      ),
      flipEvenPathRangeForward(evenFocus),
    )
  ) {
    return asUnevenPathRange(parentFocus);
  } else {
    return focus;
  }
}
export function normalizeFocusOut(
  root: ListNode,
  focus: EvenPathRange,
): EvenPathRange {
  if (isFocusOnEmptyListContent(root, focus)) {
    return focus;
  }
  return asEvenPathRange(
    whileUnevenFocusChanges(asUnevenPathRange(focus), (focus) =>
      normalizeFocusOutOnce(root, focus),
    ),
  );
}
export function whileUnevenFocusChanges(
  initialFocus: UnevenPathRange,
  cbNext: (focus: UnevenPathRange) => UnevenPathRange,
  cbVisit: (focus: UnevenPathRange) => void = () => {},
): UnevenPathRange {
  let oldFocus = initialFocus;
  while (true) {
    cbVisit(oldFocus);
    const newFocus = cbNext(oldFocus);
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
export function getEquivalentNodes(root: ListNode, originalPath: Path) {
  const equivalentFocuses: EvenPathRange[] = [];
  whileUnevenFocusChanges(
    asUnevenPathRange(
      normalizeFocusOut(root, { anchor: originalPath, offset: 0 }),
    ),
    (focus) => normalizeFocusInOnce(root, focus),
    (focus) => equivalentFocuses.push(asEvenPathRange(focus)),
  );
  const equivalentPaths = uniqueByPath(
    equivalentFocuses.filter((f) => !f.offset).map((f) => f.anchor),
    (v) => v,
  );
  if (!equivalentPaths.length) {
    throw new Error("unreachable");
  }
  return equivalentPaths.map((path) => {
    const node = nodeGetByPath(root, path);
    if (!node) {
      throw new Error("invalid path");
    }
    return { node, path };
  });
}
export function isFocusOnEmptyListContent(
  root: ListNode,
  focus: EvenPathRange,
): boolean {
  if (!focus.anchor.length) {
    return false;
  }
  const parentNode = nodeGetByPath(root, focus.anchor.slice(0, -1));
  if (!parentNode) {
    throw new Error("invalid focus");
  }
  return (
    parentNode.kind === NodeKind.List &&
    !parentNode.content.length &&
    focus.anchor[focus.anchor.length - 1] === 0 &&
    focus.offset === 0
  );
}
export function textRangeFromFocus(
  root: ListNode,
  focus: EvenPathRange,
): TextRange {
  focus = flipEvenPathRangeForward(focus);
  if (isFocusOnEmptyListContent(root, focus)) {
    const node = nodeGetByPath(root, focus.anchor.slice(0, -1));
    if (node?.kind !== NodeKind.List || node.content.length) {
      throw new Error("invalid focus");
    }
    return {
      pos: node.pos + node.delimiters[0].length,
      end: node.end - node.delimiters[1].length,
    };
  }
  const firstNode = nodeGetByPath(root, focus.anchor);
  const lastNode = nodeGetByPath(root, getPathToTip(focus));
  if (!firstNode || !lastNode) {
    throw new Error("invalid focus");
  }
  return { pos: firstNode.pos, end: lastNode.end };
}
