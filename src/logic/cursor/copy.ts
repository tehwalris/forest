import ts from "typescript";
import { isFocusOnEmptyListContent, normalizeFocusOut } from "../focus";
import { ListKind, ListNode, NodeKind } from "../interfaces";
import { Clipboard } from "../paste";
import { getStructContent } from "../struct";
import { nodeGetByPath } from "../tree-utils/access";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
interface CursorCopyArgs {
  root: ListNode;
  cursor: Cursor;
}
interface CursorCopyResult {
  cursor: Cursor;
}
export function cursorCopy({
  root,
  cursor: oldCursor,
}: CursorCopyArgs): CursorCopyResult {
  if (isFocusOnEmptyListContent(root, oldCursor.focus)) {
    return {
      cursor: adjustPostActionCursor(
        oldCursor,
        { clipboard: undefined },
        undefined,
      ),
    };
  }
  const focus = normalizeFocusOut(root, oldCursor.focus);
  let clipboard: Clipboard | undefined;
  if (focus.offset === 0) {
    const node = nodeGetByPath(root, focus.anchor);
    clipboard = node && { node: node, isPartialCopy: false };
  } else {
    if (!focus.anchor.length) {
      throw new Error("invalid focus");
    }
    const oldParent = nodeGetByPath(root, focus.anchor.slice(0, -1));
    if (oldParent?.kind !== NodeKind.List) {
      throw new Error("oldParent must be a list");
    }
    if (oldParent.structKeys) {
      console.warn(
        "can not copy multiple items from non-list node",
        focus,
        focus,
      );
    } else {
      let selectedRange = [
        focus.anchor[focus.anchor.length - 1],
        focus.anchor[focus.anchor.length - 1] + focus.offset,
      ];
      if (selectedRange[0] > selectedRange[1]) {
        selectedRange = [selectedRange[1], selectedRange[0]];
      }
      clipboard = {
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
  if (
    clipboard?.node.kind === NodeKind.List &&
    clipboard.node.listKind === ListKind.File &&
    clipboard.node.content.length === 1
  ) {
    clipboard = { node: clipboard.node.content[0], isPartialCopy: false };
  }
  if (
    clipboard?.node.kind === NodeKind.List &&
    clipboard.node.listKind === ListKind.TsNodeStruct &&
    clipboard.node.tsNode?.kind === ts.SyntaxKind.ExpressionStatement
  ) {
    clipboard = {
      node: getStructContent(clipboard.node, ["expression"], []).expression,
      isPartialCopy: false,
    };
  }
  return {
    cursor: adjustPostActionCursor(oldCursor, { clipboard }, undefined),
  };
}
