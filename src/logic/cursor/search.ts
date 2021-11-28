import {
  SearchExecutionSettings,
  StructuralSearchQuery,
} from "../../logic/search/interfaces";
import {
  getEquivalentNodes,
  isFocusOnEmptyListContent,
  normalizeFocusOut,
} from "../focus";
import { ListNode, Path } from "../interfaces";
import { nodeVisitDeepInRange } from "../tree-utils/access";
import { Cursor } from "./interfaces";
import { adjustPostActionCursor } from "./post-action";
interface CursorSearchArgs {
  root: ListNode;
  cursor: Cursor;
  query: StructuralSearchQuery;
  settings: SearchExecutionSettings;
}
interface CursorSearchResult {
  cursors: Cursor[];
}
function cursorSearch({
  root,
  cursor: oldCursor,
  query,
  settings,
}: CursorSearchArgs): CursorSearchResult {
  if (isFocusOnEmptyListContent(root, oldCursor.focus)) {
    return { cursors: [] };
  }
  const matchPaths: Path[] = [];
  if (settings.shallowSearchForRoot) {
    const focus = normalizeFocusOut(root, oldCursor.focus);
    if (focus.offset === 0) {
      for (const { node, path } of getEquivalentNodes(
        root,
        oldCursor.focus.anchor,
      )) {
        if (query.match(node)) {
          matchPaths.push(path);
        }
      }
    }
  } else {
    nodeVisitDeepInRange(
      root,
      normalizeFocusOut(root, oldCursor.focus),
      (node, path) => {
        if (query.match(node)) {
          matchPaths.push(path);
        }
      },
    );
  }
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
interface MultiCursorSearchArgs extends Omit<CursorSearchArgs, "cursor"> {
  cursors: Cursor[];
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
  settings,
  strict,
}: MultiCursorSearchArgs): MultiCursorSearchResult {
  const results = oldCursors.map((cursor) =>
    cursorSearch({ root, cursor, query, settings }),
  );
  const cursors = results.flatMap((r) => r.cursors);
  const failMask = strict ? results.map((r) => !r.cursors.length) : undefined;
  if (!cursors.length) {
    console.warn("no search matches within any cursor");
    return {
      cursors: oldCursors.map((c) => adjustPostActionCursor(c, {}, undefined)),
      failMask,
    };
  }
  return {
    cursors,
    failMask,
  };
}
