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
      adjustPostActionCursor(
        oldCursor,
        { focus: { anchor: path, offset: 0 } },
        oldCursor,
      ),
    ),
  };
}
interface MultiCursorSearchArgs {
  root: ListNode;
  cursors: Cursor[];
  query: StructuralSearchQuery;
  strict: boolean;
}
interface MultiCursorSearchResult {
  cursors: Cursor[];
  failMask?: boolean[];
}
export function multiCursorSearch({
  root,
  cursors: oldCursors,
  query,
  strict,
}: MultiCursorSearchArgs): MultiCursorSearchResult {
  const results = oldCursors.map((cursor) =>
    cursorSearch({ root, cursor, query }),
  );
  const cursors = results.flatMap((r) => r.cursors);
  if (!cursors.length) {
    console.warn("no search matches within any cursor");
    return {
      cursors: oldCursors.map((c) => adjustPostActionCursor(c, {}, undefined)),
    };
  }
  return {
    cursors,
    failMask: strict ? results.map((r) => !r.cursors.length) : undefined,
  };
}
