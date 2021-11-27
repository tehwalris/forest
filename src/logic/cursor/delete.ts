import { isFocusOnEmptyListContent, normalizeFocusOut } from "../focus";
import { EvenPathRange, ListNode, NodeKind, Path } from "../interfaces";
import { evenPathRangeIsValid, flipEvenPathRangeForward } from "../path-utils";
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
    cursor: adjustPostActionCursor(oldCursor, {}, undefined),
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
    cursor: adjustPostActionCursor(
      oldCursor,
      { focus: { anchor: parentPath, offset: 0 } },
      undefined,
    ),
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
    if (!used) {
      continue;
    }
    const newRange = replaceResult.newContentRanges[i];
    let newFocus: EvenPathRange;
    if (newRange === undefined) {
      throw new Error("unreachable");
    } else if (newRange.empty) {
      newFocus = {
        anchor: newRange.range.before.slice(0, -1),
        offset: 0,
      };
    } else if (!newRange.empty) {
      newFocus = {
        anchor: newRange.range.anchor.slice(0, -1),
        offset: 0,
      };
    } else {
      throw new Error("unreachable");
    }
    newCursors.push({
      ...cursorResults[cursorIndexByReplacement[i]].cursor,
      focus: newFocus,
    });
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
      // TODO these ranges are wrong because replaceMultiple shifts them, but does not update them correctly, since these ranges are not replacements
      newFocus = { anchor: newFocus.anchor.slice(0, -1), offset: 0 };
    }
    newFocus = normalizeFocusOut(newRoot, newFocus);
    newFocus = flipEvenPathRangeForward(newFocus);
    return { ...c, focus: newFocus };
  });
  return { root: newRoot, cursors: newCursors };
}
