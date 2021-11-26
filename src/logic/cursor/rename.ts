import ts from "typescript";
import { ListNode } from "../interfaces";
import { nodeFromTsNode } from "../node-from-ts";
import { ListItemReplacement, replaceMultiple } from "../replace-multiple";
import { nodeGetByPath, nodeGetStructKeyByPath } from "../tree-utils/access";
import { isToken } from "../ts-type-predicates";
import { checkAllItemsDefined } from "../util";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
interface CursorRenameArgs {
  root: ListNode;
  cursor: Cursor;
  rename: (s: string) => string;
}
interface CursorRenameResult {
  replacement: ListItemReplacement;
}
function cursorRename({
  root,
  cursor: oldCursor,
  rename,
}: CursorRenameArgs): CursorRenameResult | undefined {
  if (oldCursor.focus.offset !== 0) {
    return undefined;
  }
  const path = oldCursor.focus.anchor;
  const oldNode = nodeGetByPath(root, path);
  if (
    !oldNode ||
    !(isToken(oldNode, ts.isIdentifier) || isToken(oldNode, ts.isStringLiteral))
  ) {
    return undefined;
  }
  const oldStructKey = nodeGetStructKeyByPath(root, path);
  const newName = rename(oldNode.tsNode.text);
  const newNode = nodeFromTsNode(
    isToken(oldNode, ts.isIdentifier)
      ? ts.factory.createIdentifier(newName)
      : ts.factory.createStringLiteral(newName),
    undefined,
  );
  return {
    replacement: {
      range: { anchor: path, offset: 0 },
      content: [newNode],
      structKeys: oldStructKey === undefined ? undefined : [oldStructKey],
    },
  };
}
interface MultiCursorRenameArgs {
  root: ListNode;
  cursors: Cursor[];
  rename: (s: string) => string;
}
interface MultiCursorRenameResult {
  root: ListNode;
  cursors: Cursor[];
}
export function multiCursorRename({
  root: oldRoot,
  cursors: oldCursors,
  rename,
}: MultiCursorRenameArgs): MultiCursorRenameResult {
  const failResult: MultiCursorRenameResult = {
    root: oldRoot,
    cursors: oldCursors.map((c) => adjustPostActionCursor(c, {}, undefined)),
  };
  const cursorResults = oldCursors.map((cursor) =>
    cursorRename({ root: oldRoot, cursor, rename }),
  );
  if (!checkAllItemsDefined(cursorResults)) {
    console.warn(
      "not renaming because some cursors could not rename (each cursor must be focused on exactly one identifier)",
    );
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
      "not renaming because some replacements overlap or have no content",
    );
    return failResult;
  }
  return {
    root: replaceResult.root,
    cursors: oldCursors.map((c, i) =>
      adjustPostActionCursor(
        c,
        { ...c, focus: newContentRanges[i] },
        undefined,
      ),
    ),
  };
}
