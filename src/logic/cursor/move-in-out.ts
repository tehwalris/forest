import { isFocusOnEmptyListContent, normalizeFocusIn } from "../focus";
import { EvenPathRange, ListNode, NodeKind, Path } from "../interfaces";
import { evenPathRangesAreEqualIgnoringDirection } from "../path-utils";
import { nodeGetByPath, nodeVisitDeepInRange } from "../tree-utils/access";
import { unreachable } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";

export enum CursorMoveInOutDirection {
  In,
  Out,
}

interface CursorMoveInOutArgs {
  root: ListNode;
  cursor: Cursor;
  direction: CursorMoveInOutDirection;
  bigStep: boolean;
  delimiter?: string;
}

interface CursorMoveInOutResult {
  cursor: Cursor;
  didMove: boolean;
}

type MatchFn = (node: ListNode) => boolean;

export function cursorMoveInOut({
  root,
  cursor: oldCursor,
  direction,
  bigStep,
  delimiter,
}: CursorMoveInOutArgs): CursorMoveInOutResult {
  if (
    (!bigStep && direction === CursorMoveInOutDirection.In) ||
    (!bigStep && delimiter)
  ) {
    throw new Error("invalid combination of arguments");
  }

  if (!bigStep && direction === CursorMoveInOutDirection.Out) {
    return cursorMoveOutSmall({ root, cursor: oldCursor });
  }

  let isMatch: MatchFn = () => true;
  if (delimiter) {
    const delimiterIndex = direction === CursorMoveInOutDirection.In ? 0 : 1;
    isMatch = (node) => node.delimiters[delimiterIndex] === delimiter;
  }

  let focus: EvenPathRange | undefined;
  if (direction === CursorMoveInOutDirection.In) {
    focus = tryMoveIntoList(root, oldCursor.focus, isMatch);
  } else if (direction === CursorMoveInOutDirection.Out) {
    focus = tryMoveOutOfList(root, oldCursor.focus, isMatch);
  } else {
    return unreachable(direction);
  }

  if (!focus) {
    return { cursor: adjustPostActionCursor(oldCursor), didMove: false };
  }
  return {
    cursor: adjustPostActionCursor({ ...oldCursor, focus }),
    didMove: !evenPathRangesAreEqualIgnoringDirection(focus, oldCursor.focus),
  };
}

function cursorMoveOutSmall({
  root,
  cursor: oldCursor,
}: Pick<CursorMoveInOutArgs, "root" | "cursor">): CursorMoveInOutResult {
  const wrapResult = (
    focus: EvenPathRange | undefined,
  ): CursorMoveInOutResult => ({
    cursor: adjustPostActionCursor({
      ...oldCursor,
      focus: focus || oldCursor.focus,
    }),
    didMove:
      !!focus &&
      !evenPathRangesAreEqualIgnoringDirection(focus, oldCursor.focus),
  });

  if (isFocusOnEmptyListContent(root, oldCursor.focus)) {
    return wrapResult(tryMoveOutOfList(root, oldCursor.focus, () => true));
  }

  const nonDelimitedParentFocus = tryMoveToParent(root, oldCursor.focus);
  const delimitedParentFocus = tryMoveOutOfList(
    root,
    oldCursor.focus,
    () => true,
  );

  if (!nonDelimitedParentFocus || !delimitedParentFocus) {
    return wrapResult(nonDelimitedParentFocus || delimitedParentFocus);
  }

  const choiceBoolean =
    nonDelimitedParentFocus.anchor.length > delimitedParentFocus.anchor.length;
  const chosenFocus = choiceBoolean
    ? nonDelimitedParentFocus
    : delimitedParentFocus;
  const nonChosenFocus = choiceBoolean
    ? delimitedParentFocus
    : nonDelimitedParentFocus;

  let focus = normalizeFocusIn(root, chosenFocus);
  if (!wrapResult(focus).didMove) {
    focus = nonChosenFocus;
  }
  return wrapResult(focus);
}

function tryMoveIntoList(
  root: ListNode,
  focus: EvenPathRange,
  isMatch: MatchFn,
): EvenPathRange | undefined {
  let listPath: Path | undefined;
  nodeVisitDeepInRange(root, focus, (node, path) => {
    if (listPath) {
      return;
    }
    if (
      node.kind === NodeKind.List &&
      !node.equivalentToContent &&
      isMatch(node)
    ) {
      listPath = path;
    }
  });
  if (!listPath) {
    return undefined;
  }

  const listNode = nodeGetByPath(root, listPath);
  if (listNode?.kind !== NodeKind.List) {
    throw new Error("unreachable");
  }
  return {
    anchor: [...listPath, 0],
    offset: Math.max(0, listNode.content.length - 1),
  };
}

function tryMoveOutOfList(
  root: ListNode,
  focus: EvenPathRange,
  isMatch: MatchFn,
): EvenPathRange | undefined {
  while (focus.anchor.length >= 2) {
    focus = {
      anchor: focus.anchor.slice(0, -1),
      offset: 0,
    };
    const focusedNode = nodeGetByPath(root, focus.anchor);
    if (
      focusedNode?.kind === NodeKind.List &&
      !focusedNode.equivalentToContent &&
      isMatch(focusedNode)
    ) {
      return focus;
    }
  }
  return undefined;
}

function tryMoveToParent(
  root: ListNode,
  focus: EvenPathRange,
): EvenPathRange | undefined {
  while (focus.anchor.length) {
    const parentPath = focus.anchor.slice(0, -1);
    const parentNode = nodeGetByPath(root, parentPath);
    if (parentNode?.kind !== NodeKind.List) {
      throw new Error("parentNode is not a list");
    }

    const wholeParentSelected =
      Math.abs(focus.offset) + 1 === parentNode.content.length;
    if (!wholeParentSelected) {
      return {
        anchor: [...parentPath, 0],
        offset: parentNode.content.length - 1,
      };
    }

    focus = {
      anchor: parentPath,
      offset: 0,
    };
  }
  return undefined;
}
