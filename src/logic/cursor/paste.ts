import ts from "typescript";
import {
  isFocusOnEmptyListContent,
  normalizeFocusInOnce,
  normalizeFocusOut,
  whileUnevenFocusChanges,
} from "../focus";
import { EvenPathRange, ListNode, Node, NodeKind } from "../interfaces";
import {
  acceptPasteReplace,
  acceptPasteRoot,
  Clipboard,
  PasteReplaceArgs,
} from "../paste";
import {
  asEvenPathRange,
  asUnevenPathRange,
  flipEvenPathRangeForward,
  uniqueByEvenPathRange,
} from "../path-utils";
import {
  checkAllItemsAreEvenPathRange,
  ListItemReplacement,
  replaceMultiple,
} from "../replace-multiple";
import { nodeGetByPath, resetIdsDeep } from "../tree-utils/access";
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
  const focus = flipEvenPathRangeForward(oldCursor.focus);
  if (!focus.anchor.length) {
    const replacement = acceptPasteRoot({
      ...oldCursor.clipboard,
      node: resetIdsDeep(oldCursor.clipboard.node),
    });
    return (
      replacement && {
        cursor: adjustPostActionCursor(oldCursor, {}, undefined),
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
          id: Symbol(),
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
    clipboard: resetIdsDeep(oldCursor.clipboard.node),
    isPartialCopy: oldCursor.clipboard.isPartialCopy,
  });
  if (!replacement) {
    return undefined;
  }
  return {
    cursor: adjustPostActionCursor(oldCursor, {}, undefined),
    replacement: {
      ...replacement,
      range: {
        ...replacement.range,
        anchor: [...parentPath, ...replacement.range.anchor],
      },
      structKeys: oldParentNode.structKeys && replacement.structKeys,
    },
  };
}
function getEquivalentFocuses(
  root: Node,
  focus: EvenPathRange,
): EvenPathRange[] {
  if (root.kind !== NodeKind.List) {
    return [focus];
  }
  if (isFocusOnEmptyListContent(root, focus)) {
    return [focus];
  }
  const equivalentFocuses: EvenPathRange[] = [];
  whileUnevenFocusChanges(
    asUnevenPathRange(normalizeFocusOut(root, focus)),
    (focus) => normalizeFocusInOnce(root, focus),
    (focus) => equivalentFocuses.push(asEvenPathRange(focus)),
  );
  return uniqueByEvenPathRange(equivalentFocuses, (v) => v);
}
function cursorPasteEquivalent({
  root,
  cursor: oldCursor,
}: CursorPasteArgs): CursorPasteResult | undefined {
  const oldClipboard = oldCursor.clipboard;
  if (!oldClipboard) {
    return undefined;
  }
  const equivalentFocuses = getEquivalentFocuses(root, oldCursor.focus);
  const equivalentClipboards = getEquivalentFocuses(oldClipboard.node, {
    anchor: [],
    offset: 0,
  })
    .map((focus): Clipboard | undefined => {
      if (!focus.anchor.length) {
        return oldClipboard;
      } else if (focus.offset === 0) {
        const node = nodeGetByPath(oldClipboard.node, focus.anchor);
        if (!node) {
          throw new Error("invalid focus");
        }
        return { node, isPartialCopy: false };
      } else {
        const oldParent = nodeGetByPath(
          oldClipboard.node,
          focus.anchor.slice(0, -1),
        );
        if (oldParent?.kind !== NodeKind.List) {
          throw new Error("oldParent must be a list");
        }
        if (oldParent.structKeys) {
          return undefined;
        } else {
          let selectedRange = [
            focus.anchor[focus.anchor.length - 1],
            focus.anchor[focus.anchor.length - 1] + focus.offset,
          ];
          if (selectedRange[0] > selectedRange[1]) {
            selectedRange = [selectedRange[1], selectedRange[0]];
          }
          return {
            node: {
              ...oldParent,
              content: oldParent.content.slice(
                selectedRange[0],
                selectedRange[1] + 1,
              ),
            },
            isPartialCopy: true,
          };
        }
      }
    })
    .filter((v) => v)
    .map((v) => v!);
  for (const focus of equivalentFocuses) {
    for (const clipboard of equivalentClipboards) {
      const result = cursorPaste({
        root,
        cursor: { ...oldCursor, focus, clipboard },
      });
      if (result) {
        return {
          cursor: adjustPostActionCursor(oldCursor, {}, undefined),
          replacement: result.replacement,
        };
      }
    }
  }
  return undefined;
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
    cursors: oldCursors.map((c) => adjustPostActionCursor(c, {}, undefined)),
  };
  const cursorResults = oldCursors.map((cursor) =>
    cursorPasteEquivalent({ root: oldRoot, cursor }),
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
    !checkAllItemsAreEvenPathRange(newContentRanges)
  ) {
    console.warn(
      "not pasting because some replacements overlap or have no content",
    );
    return failResult;
  }
  return {
    root: replaceResult.root,
    cursors: oldCursors.map((c, i) =>
      adjustPostActionCursor(
        c,
        { focus: newContentRanges[i].range },
        undefined,
      ),
    ),
  };
}
