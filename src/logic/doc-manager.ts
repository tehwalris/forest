import { sortBy } from "ramda";
import { checkInsertion } from "./check-insertion";
import { cursorCopy } from "./cursor/copy";
import { multiCursorDelete } from "./cursor/delete";
import { cursorArraysAreEqual } from "./cursor/equal";
import { Cursor, Mark } from "./cursor/interfaces";
import {
  CursorMoveInOutDirection,
  multiCursorMoveInOut,
} from "./cursor/move-in-out";
import { CursorMoveLeafMode, multiCursorMoveLeaf } from "./cursor/move-leaf";
import { multiCursorPaste } from "./cursor/paste";
import { adjustPostActionCursor } from "./cursor/post-action";
import {
  CursorReduceAcrossSide,
  multiCursorReduceAcross,
} from "./cursor/reduce-across";
import {
  CursorReduceWithinSide,
  multiCursorReduceWithin,
} from "./cursor/reduce-within";
import { multiCursorRename } from "./cursor/rename";
import { multiCursorSearch } from "./cursor/search";
import {
  CursorStartInsertSide,
  multiCursorStartInsert,
} from "./cursor/start-insert";
import { emptyDoc } from "./doc-utils";
import {
  isFocusOnEmptyListContent,
  normalizeFocusIn,
  normalizeFocusOut,
  textRangeFromFocus,
} from "./focus";
import { Doc, InsertState, NodeKind, Path } from "./interfaces";
import { memoize } from "./memoize";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import { hasOverlappingNonNestedRanges } from "./path-range-tree";
import {
  flipEvenPathRangeForward,
  pathIsInRange,
  uniqueByEvenPathRange,
} from "./path-utils";
import {
  getDocWithAllPlaceholders,
  getDocWithoutPlaceholdersNearCursors,
} from "./placeholders";
import { StructuralSearchQuery } from "./search/interfaces";
import {
  checkTextRangesOverlap,
  getDocWithInsertions,
  Insertion,
} from "./text";
import { trackRanges } from "./track-ranges";
import { nodeGetByPath } from "./tree-utils/access";
export enum Mode {
  Normal,
  Insert,
}
export enum MultiCursorMode {
  Relaxed,
  Drop,
  Strict,
}
interface MultiCursorFailure {
  failedCursorIds: Symbol[];
  beforeFailure: DocManager;
}
enum MultiCursorFailureResolution {
  Ignore,
  RevertSuccess,
  RevertFailure,
}
export enum CursorOverlapKind {
  None,
  Nested,
  NonNested,
}
export interface DocManagerPublicState {
  doc: Doc;
  mode: Mode;
  multiCursorMode: MultiCursorMode;
  failedCursors: { success: number; failure: number } | undefined;
  cursors: Cursor[];
  cursorsOverlap: CursorOverlapKind;
  queuedCursors: Cursor[];
}
const initialCursor: Cursor = {
  id: Symbol(),
  parentPath: [],
  focus: { anchor: [], offset: 0 },
  enableReduceToTip: false,
  clipboard: undefined,
  marks: [],
};
export const initialDocManagerPublicState: DocManagerPublicState = {
  doc: emptyDoc,
  mode: Mode.Normal,
  multiCursorMode: MultiCursorMode.Relaxed,
  failedCursors: undefined,
  cursors: [initialCursor],
  cursorsOverlap: CursorOverlapKind.None,
  queuedCursors: [],
};
export interface MinimalKeyboardEvent {
  key: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}
function hasAltLike(ev: MinimalKeyboardEvent): ev is MinimalKeyboardEvent &
  (
    | {
        altKey: true;
      }
    | {
        metaKey: true;
      }
  ) {
  return !!ev.altKey || !!ev.metaKey;
}
interface InsertHistoryEntry {
  insertState: InsertState;
}
export class DocManager {
  public readonly initialDoc: Doc;
  private cursors: Cursor[] = [initialCursor];
  private queuedCursors: Cursor[] = [];
  private insertHistory: InsertHistoryEntry[] = [];
  private cursorHistory: Cursor[][] = [];
  private cursorRedoHistory: Cursor[][] = [];
  private mode = Mode.Normal;
  private lastMode: Mode = this.mode;
  private multiCursorMode = MultiCursorMode.Relaxed;
  private multiCursorFailure: MultiCursorFailure | undefined;
  private lastDoc: Doc;
  private insertState: InsertState | undefined;
  private chordKey: string | undefined;
  private getDocWithoutPlaceholdersNearCursors = memoize(
    getDocWithoutPlaceholdersNearCursors,
  );
  constructor(
    private doc: Doc,
    private _onUpdate: (publicState: DocManagerPublicState) => void,
    private readOnly: boolean,
  ) {
    this.initialDoc = doc;
    this.lastDoc = doc;
  }
  private static copyDocManagerFields(source: DocManager, target: DocManager) {
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "function") {
        continue;
      }
      if (Array.isArray(v)) {
        (target as any)[k] = [...v];
      } else {
        (target as any)[k] = v;
      }
    }
  }
  clone(): DocManager {
    const other = new DocManager(this.initialDoc, this.onUpdate, this.readOnly);
    DocManager.copyDocManagerFields(this, other);
    return other;
  }
  fillFromOther(other: DocManager) {
    DocManager.copyDocManagerFields(other, this);
  }
  forceUpdate() {
    if (this.mode !== Mode.Normal) {
      throw new Error("forceUpdate can only be called in normal mode");
    }
    this.onUpdate();
    this.insertHistory = [];
  }
  disableUpdates() {
    this._onUpdate = () => {};
  }
  onKeyPress = (ev: MinimalKeyboardEvent) => {
    ev = {
      key: ev.key,
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      metaKey: ev.metaKey,
      preventDefault: ev.preventDefault?.bind(ev),
      stopPropagation: ev.stopPropagation?.bind(ev),
    };
    if (this.mode === Mode.Normal) {
      if (this.chordKey) {
        ev.key = `${this.chordKey} ${ev.key}`;
        this.chordKey = undefined;
      } else if (["S", "m", "M", "y", "Y"].includes(ev.key)) {
        this.chordKey = ev.key;
        return;
      }

      if (ev.key === "i" && !this.readOnly) {
        const result = multiCursorStartInsert({
          root: this.doc.root,
          cursors: this.cursors,
          side: CursorStartInsertSide.Before,
        });
        if (result) {
          this.mode = Mode.Insert;
          this.insertState = result.insertState;
          this.cursors = result.cursors;
        }
      } else if (ev.key === "a" && !this.readOnly) {
        const result = multiCursorStartInsert({
          root: this.doc.root,
          cursors: this.cursors,
          side: CursorStartInsertSide.After,
        });
        if (result) {
          this.mode = Mode.Insert;
          this.insertState = result.insertState;
          this.cursors = result.cursors;
        }
      } else if (ev.key === "d" && !this.readOnly) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorDelete({
              root: this.doc.root,
              cursors: this.cursors,
              strict,
            }),
          (result) => {
            this.doc = { ...this.doc, root: result.root };
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "r" && !this.readOnly) {
        const renameFunctionBody = prompt(
          'Enter an JS expression to perform renaming with. "s" is the old name. Example: "s.toLowerCase()"',
        );
        if (renameFunctionBody === null) {
          return;
        }
        const _rename: (s: string) => unknown = new Function(
          "s",
          `return (${renameFunctionBody})`,
        ) as any;
        const rename = (oldName: string): string => {
          const newName = _rename(oldName);
          if (typeof newName !== "string") {
            throw new Error("new name is not a string");
          }
          return newName;
        };
        const result = multiCursorRename({
          root: this.doc.root,
          cursors: this.cursors,
          rename,
        });
        this.doc = { ...this.doc, root: result.root };
        this.cursors = result.cursors;
      } else if (ev.key.match(/^y [rds]$/)) {
        this.multiCursorMode = {
          r: MultiCursorMode.Relaxed,
          d: MultiCursorMode.Drop,
          s: MultiCursorMode.Strict,
        }[ev.key.split(" ")[1]]!;
      } else if (ev.key.match(/^Y [isf]$/)) {
        const failure = this.multiCursorFailure;
        if (!failure) {
          return;
        }
        const resolution = {
          i: MultiCursorFailureResolution.Ignore,
          s: MultiCursorFailureResolution.RevertSuccess,
          f: MultiCursorFailureResolution.RevertFailure,
        }[ev.key.split(" ")[1]]!;
        if (resolution === MultiCursorFailureResolution.Ignore) {
          this.multiCursorFailure = undefined;
        } else {
          const failedCursorIds = new Set(failure.failedCursorIds);
          const newCursors = failure.beforeFailure.cursors.filter((c) =>
            resolution === MultiCursorFailureResolution.RevertSuccess
              ? !failedCursorIds.has(c.id)
              : failedCursorIds.has(c.id),
          );
          if (!newCursors.length) {
            console.warn(
              "chosen multi cursor failure resolution would leave no cursors",
            );
            return;
          }
          this.fillFromOther(failure.beforeFailure);
          this.cursors = newCursors;
        }
      } else if (ev.key.match(/^m [a-z]$/)) {
        const markKey = ev.key.split(" ")[1];
        this.cursors = this.cursors.map((c) => ({
          ...c,
          marks: [
            ...c.marks.filter((m) => m.key !== markKey),
            { key: markKey, focus: c.focus },
          ],
        }));
      } else if (ev.key.match(/^M [a-z]$/)) {
        const markKey = ev.key.split(" ")[1];
        this.cursors = this.cursors.map((c) => ({
          ...c,
          focus: c.marks.find((m) => m.key === markKey)?.focus || c.focus,
        }));
      } else if (ev.key === "s") {
        this.cursors = this.cursors.flatMap((cursor): Cursor[] => {
          const focus = flipEvenPathRangeForward(cursor.focus);
          if (
            isFocusOnEmptyListContent(this.doc.root, focus) ||
            !focus.offset
          ) {
            return [adjustPostActionCursor(cursor, {}, cursor)];
          }
          const parentPath = focus.anchor.slice(0, -1);
          const focusedNode = nodeGetByPath(this.doc.root, parentPath);
          if (
            focusedNode?.kind !== NodeKind.List ||
            !focusedNode.content.length
          ) {
            throw new Error("invalid focus");
          }
          return focusedNode.content
            .map((_child, i): Path => [...parentPath, i])
            .filter((path) => pathIsInRange(path, focus))
            .map((path) =>
              adjustPostActionCursor(
                cursor,
                {
                  focus: { anchor: path, offset: 0 },
                },
                cursor,
              ),
            );
        });
      } else if (ev.key.match(/^S [hljkf]$/)) {
        const side = {
          h: CursorReduceAcrossSide.First,
          l: CursorReduceAcrossSide.Last,
          j: CursorReduceAcrossSide.Inner,
          k: CursorReduceAcrossSide.Outer,
          f: CursorReduceAcrossSide.FixOverlap,
        }[ev.key.split(" ")[1]]!;
        const result = multiCursorReduceAcross({ cursors: this.cursors, side });
        this.cursors = result.cursors;
      } else if (ev.key === "q") {
        this.queuedCursors = uniqueByEvenPathRange(
          [...this.cursors, ...this.queuedCursors],
          (c) => flipEvenPathRangeForward(c.focus),
        );
      } else if (ev.key === "Q") {
        if (!this.queuedCursors.length) {
          return;
        }
        this.cursors = this.queuedCursors.map((c) =>
          adjustPostActionCursor(c, {}, c),
        );
        this.queuedCursors = [];
      } else if (ev.key === "l" && !hasAltLike(ev)) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveLeaf({
              root: this.doc.root,
              cursors: this.cursors,
              direction: 1,
              mode: CursorMoveLeafMode.Move,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "L" && !ev.ctrlKey) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveLeaf({
              root: this.doc.root,
              cursors: this.cursors,
              direction: 1,
              mode: CursorMoveLeafMode.ExtendSelection,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "h" && !hasAltLike(ev)) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveLeaf({
              root: this.doc.root,
              cursors: this.cursors,
              direction: -1,
              mode: CursorMoveLeafMode.Move,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "H" && !ev.ctrlKey) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveLeaf({
              root: this.doc.root,
              cursors: this.cursors,
              direction: -1,
              mode: CursorMoveLeafMode.ExtendSelection,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "k") {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveInOut({
              root: this.doc.root,
              cursors: this.cursors,
              direction: CursorMoveInOutDirection.Out,
              bigStep: false,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "K") {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveInOut({
              root: this.doc.root,
              cursors: this.cursors,
              direction: CursorMoveInOutDirection.Out,
              bigStep: true,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if ([")", "]", "}", ">"].includes(ev.key)) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveInOut({
              root: this.doc.root,
              cursors: this.cursors,
              direction: CursorMoveInOutDirection.Out,
              bigStep: true,
              delimiter: ev.key,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "j") {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveInOut({
              root: this.doc.root,
              cursors: this.cursors,
              direction: CursorMoveInOutDirection.In,
              bigStep: true,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (["(", "[", "{", "<"].includes(ev.key)) {
        this.multiCursorHelper(
          (strict) =>
            multiCursorMoveInOut({
              root: this.doc.root,
              cursors: this.cursors,
              direction: CursorMoveInOutDirection.In,
              bigStep: true,
              delimiter: ev.key,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === " ") {
        ev.preventDefault?.();
        this.multiCursorHelper(
          (strict) =>
            multiCursorReduceWithin({
              root: this.doc.root,
              cursors: this.cursors,
              side: CursorReduceWithinSide.JustExtended,
              strict,
            }),
          (result) => {
            this.cursors = result.cursors;
          },
        );
      } else if (ev.key === "c") {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorCopy({
              root: this.doc.root,
              cursor: cursor,
            }).cursor,
        );
      } else if (ev.key === "p" && !this.readOnly) {
        const result = multiCursorPaste({
          root: this.doc.root,
          cursors: this.cursors,
        });
        this.doc = { ...this.doc, root: result.root };
        this.cursors = result.cursors;
      } else if (ev.key === "z") {
        while (this.cursorHistory.length) {
          const cursors = this.cursorHistory.pop()!;
          if (cursorArraysAreEqual(cursors, this.cursors)) {
            continue;
          }
          this.cursorRedoHistory.push(this.cursors);
          this.cursors = cursors;
          break;
        }
      } else if (ev.key === "Z") {
        while (this.cursorRedoHistory.length) {
          const cursors = this.cursorRedoHistory.pop()!;
          if (cursorArraysAreEqual(cursors, this.cursors)) {
            continue;
          }
          this.cursorHistory.push(this.cursors);
          this.cursors = cursors;
          break;
        }
      }
    } else if (this.mode === Mode.Insert) {
      if (ev.key.length !== 1) {
        return;
      }
      ev.preventDefault?.();
      ev.stopPropagation?.();
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      this.insertHistory.push({ insertState: this.insertState });
      this.insertState = {
        ...this.insertState,
        text: this.insertState.text + ev.key,
      };
    }
    this.onUpdate();
  };
  onKeyDown = (ev: MinimalKeyboardEvent) => {
    if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "h" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      this.multiCursorHelper(
        (strict) =>
          multiCursorReduceWithin({
            root: this.doc.root,
            cursors: this.cursors,
            side: CursorReduceWithinSide.First,
            strict,
          }),
        (result) => {
          this.cursors = result.cursors;
        },
      );
      this.onUpdate();
    } else if (this.mode === Mode.Normal && ev.key === "H" && ev.ctrlKey) {
      ev.preventDefault?.();
      this.multiCursorHelper(
        (strict) =>
          multiCursorMoveLeaf({
            root: this.doc.root,
            cursors: this.cursors,
            direction: -1,
            mode: CursorMoveLeafMode.ShrinkSelection,
            strict,
          }),
        (result) => {
          this.cursors = result.cursors;
        },
      );
      this.onUpdate();
    } else if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "l" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      this.multiCursorHelper(
        (strict) =>
          multiCursorReduceWithin({
            root: this.doc.root,
            cursors: this.cursors,
            side: CursorReduceWithinSide.Last,
            strict,
          }),
        (result) => {
          this.cursors = result.cursors;
        },
      );
      this.onUpdate();
    } else if (this.mode === Mode.Normal && ev.key === "L" && ev.ctrlKey) {
      ev.preventDefault?.();
      this.multiCursorHelper(
        (strict) =>
          multiCursorMoveLeaf({
            root: this.doc.root,
            cursors: this.cursors,
            direction: 1,
            mode: CursorMoveLeafMode.ShrinkSelection,
            strict,
          }),
        (result) => {
          this.cursors = result.cursors;
        },
      );
      this.onUpdate();
    } else if (this.mode === Mode.Normal && ev.key === "Escape") {
      this.chordKey = undefined;
      this.onUpdate();
    } else if (this.mode === Mode.Insert && ev.key === "Escape") {
      const finalStuff = () => {
        this.mode = Mode.Normal;
        this.insertHistory = [];
        this.insertState = undefined;
        this.onUpdate();
      };
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (!this.insertState.text) {
        finalStuff();
        return;
      }
      const {
        doc: oldDocWithoutPlaceholders,
        cursorBeforePositions:
          cursorBeforePositionsAdjustedForPlaceholderRemoval,
      } = getDocWithoutPlaceholdersNearCursors(
        this.doc,
        this.insertState.beforePos,
      );
      const insertions: Insertion[] =
        cursorBeforePositionsAdjustedForPlaceholderRemoval.map(
          (beforePos, i) => ({
            beforePos,
            duplicateIndex: this.insertState!.duplicateIndices[i],
            text: this.insertState!.text,
          }),
        );
      const astWithInsertBeforeFormatting = astFromTypescriptFileContent(
        getDocWithInsertions(oldDocWithoutPlaceholders, insertions).text,
      );
      if (astWithInsertBeforeFormatting.parseDiagnostics.length) {
        console.warn(
          "file has syntax errors",
          astWithInsertBeforeFormatting.parseDiagnostics,
          astWithInsertBeforeFormatting.text,
        );
        return;
      }
      const docWithInsertBeforeFormatting = docFromAst(
        astWithInsertBeforeFormatting,
      );
      const checkedInsertion = checkInsertion({
        oldDoc: oldDocWithoutPlaceholders,
        newDoc: docWithInsertBeforeFormatting,
        insertions,
      });
      if (!checkedInsertion.valid) {
        console.warn("checkedInsertion is not valid:", checkedInsertion.reason);
        return;
      }
      for (const [
        oldNode,
        newNode,
      ] of checkedInsertion.newNodesByOldTraceableNodes.entries()) {
        newNode.isPlaceholder = oldNode.isPlaceholder;
        newNode.id = oldNode.id;
      }
      this.cursors = this.cursors.map((cursor, i) => ({
        ...cursor,
        focus: checkedInsertion.insertionPathRanges[i],
      }));
      this.doc = docWithInsertBeforeFormatting;
      finalStuff();
    } else if (this.mode === Mode.Insert && ev.key === "Backspace") {
      const old = this.insertHistory.pop();
      if (!old) {
        return;
      }
      this.insertState = old.insertState;
      this.onUpdate();
    }
  };
  onKeyUp = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.Insert) {
      ev.stopPropagation?.();
      ev.preventDefault?.();
    }
  };
  private onUpdate() {
    const docChanged = this.doc !== this.lastDoc;
    if (this.mode === Mode.Insert) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.insertHistory = [];
      }
    }
    this.lastMode = this.mode;
    if (this.readOnly && this.mode === Mode.Insert) {
      throw new Error("this.readOnly && this.mode === Mode.Insert");
    }
    if (docChanged) {
      if (this.readOnly) {
        throw new Error("this.readOnly && docChanged");
      }
      this.cursors = this.cursors.map((cursor) => ({
        ...cursor,
        focus: normalizeFocusOut(this.doc.root, cursor.focus),
      }));
      this.updateDocText();
      this.updateMarkRanges();
      this.cursorHistory = [];
      this.cursorRedoHistory = [];
      this.queuedCursors = [];
    }
    this.cursors = this.cursors.map((cursor) => ({
      ...cursor,
      focus: normalizeFocusIn(this.doc.root, cursor.focus),
      marks: cursor.marks.map((m) => ({
        ...m,
        focus: normalizeFocusIn(this.doc.root, m.focus),
      })),
    }));
    if (!this.insertState) {
      this.cursors = sortBy(
        (c) => textRangeFromFocus(this.doc.root, c.focus).pos,
        this.cursors,
      );
    }
    this.cursorHistory.push(this.cursors);
    this.lastDoc = this.doc;
    this.reportUpdate();
  }
  private multiCursorHelper<T extends { failMask?: boolean[] }>(
    planAction: (strict: boolean) => T,
    applyAction: (result: T) => void,
  ) {
    const backup = this.clone();
    const multiCursorMode = this.multiCursorMode;
    const strict = multiCursorMode !== MultiCursorMode.Relaxed;
    const result = planAction(strict);
    if (!result.failMask !== !strict) {
      throw new Error("failMask must be defined iff strict mode is used");
    }
    const someFailed = !!result.failMask?.some((v) => v);
    const failedCursorIds = new Set(
      this.cursors.filter((_c, i) => result.failMask?.[i]).map((c) => c.id),
    );
    if (strict && someFailed) {
      if (this.multiCursorFailure) {
        this.multiCursorFailure = {
          failedCursorIds: [...this.multiCursorFailure.failedCursorIds],
          beforeFailure: this.multiCursorFailure.beforeFailure,
        };
      } else {
        this.multiCursorFailure = {
          failedCursorIds: [],
          beforeFailure: this.clone(),
        };
      }
      this.multiCursorFailure.failedCursorIds.push(
        ...this.cursors.filter((_c, i) => result.failMask![i]).map((c) => c.id),
      );
    }
    if (multiCursorMode === MultiCursorMode.Strict && someFailed) {
      console.warn("action rejected because some cursors failed");
    } else {
      applyAction(result);
    }
    if (multiCursorMode === MultiCursorMode.Drop && someFailed) {
      const newCursors = this.cursors.filter((c) => !failedCursorIds.has(c.id));
      if (newCursors.length) {
        this.cursors = newCursors;
      } else {
        console.warn("refusing to drop all cursors");
        this.fillFromOther(backup);
      }
    }
  }
  search(query: StructuralSearchQuery) {
    this.multiCursorHelper(
      (strict) =>
        multiCursorSearch({
          root: this.doc.root,
          cursors: this.cursors,
          query,
          strict,
        }),
      (result) => {
        this.cursors = result.cursors;
      },
    );
    this.onUpdate();
  }
  private reportUpdate() {
    let doc = this.doc;
    if (this.insertState) {
      const {
        doc: oldDocWithoutPlaceholders,
        cursorBeforePositions:
          cursorBeforePositionsAdjustedForPlaceholderRemoval,
      } = this.getDocWithoutPlaceholdersNearCursors(
        this.doc,
        this.insertState.beforePos,
      );
      doc = getDocWithInsertions(
        oldDocWithoutPlaceholders,
        cursorBeforePositionsAdjustedForPlaceholderRemoval.map(
          (beforePos, i) => ({
            beforePos,
            duplicateIndex: this.insertState!.duplicateIndices[i],
            text: this.insertState!.text,
          }),
        ),
      );
    }
    this._onUpdate({
      doc,
      mode: this.mode,
      multiCursorMode: this.multiCursorMode,
      failedCursors: this.countMultiCursorFailure(),
      cursors: this.cursors,
      cursorsOverlap: this.getCursorOverlapKind(),
      queuedCursors: this.queuedCursors,
    });
  }
  private countMultiCursorFailure():
    | { success: number; failure: number }
    | undefined {
    if (!this.multiCursorFailure) {
      return undefined;
    }
    const failedCursorIds = new Set(this.multiCursorFailure.failedCursorIds);
    const cursors = this.multiCursorFailure.beforeFailure.cursors;
    const failedCursors = cursors.filter((c) => failedCursorIds.has(c.id));
    return {
      success: cursors.length - failedCursors.length,
      failure: failedCursors.length,
    };
  }
  private getCursorOverlapKind(): CursorOverlapKind {
    if (
      hasOverlappingNonNestedRanges(
        this.cursors.map((c) => flipEvenPathRangeForward(c.focus)),
      )
    ) {
      return CursorOverlapKind.NonNested;
    }
    if (
      checkTextRangesOverlap(
        this.cursors.map((c) => textRangeFromFocus(this.doc.root, c.focus)),
      )
    ) {
      return CursorOverlapKind.Nested;
    }
    return CursorOverlapKind.None;
  }
  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
  }
  private updateMarkRanges() {
    const oldRanges = this.cursors.flatMap((c) => c.marks).map((m) => m.focus);
    const newRanges = trackRanges(this.lastDoc.root, this.doc.root, oldRanges);
    const remainingNewRanges = [...newRanges];
    this.cursors = this.cursors.map(
      (c): Cursor => ({
        ...c,
        marks: c.marks
          .map((m) => ({
            ...m,
            focus: remainingNewRanges.shift(),
          }))
          .filter((m) => m.focus !== undefined)
          .map(
            (m): Mark => ({
              ...m,
              focus: normalizeFocusIn(this.doc.root, m.focus!),
            }),
          ),
      }),
    );
  }
}
