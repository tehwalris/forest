import ts from "typescript";
import { isFocusOnEmptyListContent, normalizeFocusOut } from "../focus";
import { ListNode, NodeKind } from "../interfaces";
import {
  acceptPasteReplace,
  acceptPasteRoot,
  PasteReplaceArgs,
} from "../paste";
import { flipEvenPathRangeForward } from "../path-utils";
import { ListItemReplacement, replaceMultiple } from "../replace-multiple";
import { nodeGetByPath } from "../tree-utils/access";
import { checkAllItemsDefined } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";

interface CursorPasteArgs {
  root: ListNode;
  cursor: Cursor;
}

interface CursorPasteResult {
  replacement: ListItemReplacement;
  cursor: Cursor;
}

function cursorPaste({
  root,
  cursor: oldCursor,
}: CursorPasteArgs): CursorPasteResult | undefined {
  if (!oldCursor.clipboard) {
    return undefined;
  }
  const focus = flipEvenPathRangeForward(
    normalizeFocusOut(root, oldCursor.focus),
  );

  if (!focus.anchor.length) {
    const replacement = acceptPasteRoot(oldCursor.clipboard);
    return (
      replacement && {
        cursor: adjustPostActionCursor(oldCursor),
        replacement,
      }
    );
  }

  const parentPath = focus.anchor.slice(0, -1);
  let oldParentNode = nodeGetByPath(root, parentPath);
  if (oldParentNode?.kind !== NodeKind.List) {
    throw new Error("expected parent to exist and be a list");
  }
  if (isFocusOnEmptyListContent(root, focus)) {
    oldParentNode = {
      ...oldParentNode,
      content: [
        {
          kind: NodeKind.Token,
          pos: -1,
          end: -1,
          isPlaceholder: true,
          tsNode: ts.factory.createIdentifier("placeholder"),
        },
      ],
    };
  }

  let grandparentInfo: PasteReplaceArgs["parent"];
  if (focus.anchor.length >= 2) {
    const grandparentPath = focus.anchor.slice(0, -2);
    const oldGrandparentNode = nodeGetByPath(root, grandparentPath);
    if (oldGrandparentNode?.kind !== NodeKind.List) {
      throw new Error("expected grandparent to exist and be a list");
    }
    grandparentInfo = {
      node: oldGrandparentNode,
      childIndex: parentPath[parentPath.length - 1],
    };
  }

  const firstIndex = focus.anchor[focus.anchor.length - 1];
  const replacement = acceptPasteReplace({
    node: oldParentNode,
    parent: grandparentInfo,
    firstIndex,
    lastIndex: firstIndex + focus.offset,
    clipboard: oldCursor.clipboard.node,
    isPartialCopy: oldCursor.clipboard.isPartialCopy,
  });
  if (!replacement) {
    return undefined;
  }
  return {
    cursor: adjustPostActionCursor(oldCursor),
    replacement: {
      ...replacement,
      range: {
        ...replacement.range,
        anchor: [...parentPath, ...replacement.range.anchor],
      },
    },
  };
}

interface MultiCursorPasteArgs {
  root: ListNode;
  cursors: Cursor[];
}

interface MultiCursorPasteResult {
  root: ListNode;
  cursors: Cursor[];
}

export function multiCursorPaste({
  root: oldRoot,
  cursors: oldCursors,
}: MultiCursorPasteArgs): MultiCursorPasteResult {
  const failResult: MultiCursorPasteResult = {
    root: oldRoot,
    cursors: oldCursors.map((c) => adjustPostActionCursor(c)),
  };

  const cursorResults = oldCursors.map((cursor) =>
    cursorPaste({ root: oldRoot, cursor }),
  );
  if (!checkAllItemsDefined(cursorResults)) {
    console.warn("not pasting because some cursors could not paste");
    return failResult;
  }

  const replaceResult = replaceMultiple({
    root: oldRoot,
    replacements: cursorResults.map((r) => r.replacement),
  });
  const newContentRanges = replaceResult.newContentRanges;
  if (
    replaceResult.ambiguousOverlap ||
    !replaceResult.replacementWasUsed.every((v) => v) ||
    !checkAllItemsDefined(newContentRanges)
  ) {
    console.warn(
      "not pasting because some replacements overlap or have no content",
    );
    return failResult;
  }

  return {
    root: replaceResult.root,
    cursors: oldCursors.map((c, i) =>
      adjustPostActionCursor({ ...c, focus: newContentRanges[i] }),
    ),
  };
}
