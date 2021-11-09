import { EvenPathRange, ListNode, NodeKind, Path } from "../interfaces";
import { nodeGetByPath, nodeVisitDeepInRange } from "../tree-utils/access";
import { unreachable } from "../util";
import { Cursor } from "./interfaces";

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
    return {
      cursor: { focus: oldCursor.focus, enableReduceToTip: false },
      didMove: false,
    };
  }
  return { cursor: { focus, enableReduceToTip: false }, didMove: true };
}

function cursorMoveOutSmall({
  cursor: oldCursor,
}: Pick<CursorMoveInOutArgs, "root" | "cursor">): CursorMoveInOutResult {
  // TODO
  return {
    cursor: { focus: oldCursor.focus, enableReduceToTip: false },
    didMove: false,
  };
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
