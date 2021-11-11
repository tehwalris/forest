import { isFocusOnEmptyListContent, normalizeFocusOut } from "../focus";
import { ListNode, NodeKind, Path } from "../interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangeIsValid,
  flipEvenPathRangeForward,
  uniqueByEvenPathRange,
} from "../path-utils";
import { ListItemReplacement, replaceMultiple } from "../replace-multiple";
import { nodeGetByPath } from "../tree-utils/access";
import { withoutInvisibleNodes } from "../without-invisible";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";

interface CursorDeleteArgs {
  root: ListNode;
  cursor: Cursor;
}

interface CursorDeleteResult {
  replacement?: ListItemReplacement;
  cursor: Cursor;
}

function cursorDelete({
  root,
  cursor: oldCursor,
}: CursorDeleteArgs): CursorDeleteResult {
  const failResult: CursorDeleteResult = {
    cursor: adjustPostActionCursor(oldCursor),
  };

  if (isFocusOnEmptyListContent(root, oldCursor.focus)) {
    return failResult;
  }

  let deleteRange = flipEvenPathRangeForward(oldCursor.focus);
  if (deleteRange.anchor.length === 0) {
    if (!root.content.length) {
      return failResult;
    }
    deleteRange = { anchor: [0], offset: root.content.length - 1 };
  }

  const parentPath: Path = deleteRange.anchor.slice(0, -1);
  const parentNode = nodeGetByPath(root, parentPath);
  if (parentNode?.kind !== NodeKind.List) {
    throw new Error("invalid focus");
  }

  return {
    replacement: {
      range: deleteRange,
      content: [],
      structKeys: parentNode.structKeys ? [] : undefined,
    },
    cursor: adjustPostActionCursor({
      ...oldCursor,
      focus: { anchor: parentPath, offset: 0 },
    }),
  };
}

interface MultiCursorDeleteArgs {
  root: ListNode;
  cursors: Cursor[];
}

interface MultiCursorDeleteResult {
  root: ListNode;
  cursors: Cursor[];
}

export function multiCursorDelete({
  root: oldRoot,
  cursors: oldCursors,
}: MultiCursorDeleteArgs): MultiCursorDeleteResult {
  const cursorResults = oldCursors.map((cursor) =>
    cursorDelete({ root: oldRoot, cursor }),
  );

  const replacements: ListItemReplacement[] = [];
  const cursorIndexByReplacement: number[] = [];
  for (const [i, cursorResult] of cursorResults.entries()) {
    if (cursorResult.replacement) {
      replacements.push(cursorResult.replacement);
      cursorIndexByReplacement.push(i);
    }
  }

  const replaceResult = replaceMultiple({ root: oldRoot, replacements });

  let newCursors: Cursor[] = [];
  for (const [i, used] of replaceResult.replacementWasUsed.entries()) {
    if (used) {
      newCursors.push(cursorResults[cursorIndexByReplacement[i]].cursor);
    }
  }

  if (
    !newCursors.every((c) => evenPathRangeIsValid(replaceResult.root, c.focus))
  ) {
    throw new Error(
      "remaining cursors invalid before removing invisible nodes",
    );
  }
  const newRoot = withoutInvisibleNodes(replaceResult.root);
  newCursors = newCursors.map((c) => {
    let newFocus = c.focus;
    while (!evenPathRangeIsValid(newRoot, newFocus)) {
      if (!newFocus.anchor.length) {
        throw new Error("unreachable");
      }
      newFocus = { anchor: newFocus.anchor.slice(0, -1), offset: 0 };
    }
    newFocus = asEvenPathRange(
      normalizeFocusOut(newRoot, asUnevenPathRange(newFocus)),
    );
    newFocus = flipEvenPathRangeForward(newFocus);
    return { ...c, focus: newFocus };
  });

  newCursors = uniqueByEvenPathRange(newCursors, (c) => c.focus);

  if (!newCursors.length) {
    throw new Error(
      "no cursors remaining after deletion - this should not happen",
    );
  }

  return { root: newRoot, cursors: newCursors };
}
