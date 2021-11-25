import { StructuralSearchQuery } from "../../logic/search/interfaces";
import { isFocusOnEmptyListContent, normalizeFocusOut } from "../focus";
import { ListNode, Path } from "../interfaces";
import { nodeVisitDeepInRange } from "../tree-utils/access";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
interface CursorSearchArgs {
  root: ListNode;
  cursor: Cursor;
  query: StructuralSearchQuery;
}
interface CursorSearchResult {
  cursors: Cursor[];
}
function cursorSearch({
  root,
  cursor: oldCursor,
  query,
}: CursorSearchArgs): CursorSearchResult {
  if (isFocusOnEmptyListContent(root, oldCursor.focus)) {
    return { cursors: [] };
  }
  const matchPaths: Path[] = [];
  nodeVisitDeepInRange(
    root,
    normalizeFocusOut(root, oldCursor.focus),
    (node, path) => {
      if (query.match(node)) {
        matchPaths.push(path);
      }
    },
  );
  return {
    cursors: matchPaths.map((path) =>
      adjustPostActionCursor({
        ...oldCursor,
        focus: { anchor: path, offset: 0 },
      }),
    ),
  };
}
interface MultiCursorSearchArgs {
  root: ListNode;
  cursors: Cursor[];
  query: StructuralSearchQuery;
}
interface MultiCursorSearchResult {
  cursors: Cursor[];
}
export function multiCursorSearch({
  root,
  cursors: oldCursors,
  query,
}: MultiCursorSearchArgs): MultiCursorSearchResult {
  const cursors = oldCursors.flatMap(
    (cursor) => cursorSearch({ root, cursor, query }).cursors,
  );
  if (!cursors.length) {
    console.warn("no search matches within any cursor");
    return { cursors: oldCursors.map((c) => adjustPostActionCursor(c)) };
  }
  return { cursors };
}
