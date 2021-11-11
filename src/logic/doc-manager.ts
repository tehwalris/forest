import { checkInsertion } from "./check-insertion";
import { cursorCopy } from "./cursor/copy";
import { multiCursorDelete } from "./cursor/delete";
import { cursorArraysAreEqual } from "./cursor/equal";
import { Cursor } from "./cursor/interfaces";
import {
  cursorMoveInOut,
  CursorMoveInOutDirection,
} from "./cursor/move-in-out";
import { cursorMoveLeaf, CursorMoveLeafMode } from "./cursor/move-leaf";
import { adjustPostActionCursor } from "./cursor/post-action";
import {
  cursorReduceSelection,
  CursorReduceSelectionSide,
} from "./cursor/reduce-selection";
import {
  CursorStartInsertSide,
  multiCursorStartInsert,
} from "./cursor/start-insert";
import { emptyDoc } from "./doc-utils";
import {
  isFocusOnEmptyListContent,
  normalizeFocusIn,
  textRangeFromFocus,
} from "./focus";
import { Doc, InsertState, NodeKind, Path } from "./interfaces";
import { memoize } from "./memoize";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import {
  asEvenPathRange,
  asUnevenPathRange,
  flipEvenPathRangeForward,
  pathIsInRange,
} from "./path-utils";
import {
  getDocWithAllPlaceholders,
  getDocWithoutPlaceholdersNearCursors,
} from "./placeholders";
import {
  checkTextRangesOverlap,
  getDocWithInsertions,
  Insertion,
} from "./text";
import { nodeGetByPath } from "./tree-utils/access";

export enum Mode {
  Normal,
  Insert,
}

export interface DocManagerPublicState {
  doc: Doc;
  mode: Mode;
  cursors: Cursor[];
  cursorsOverlap: boolean;
}

const initialCursor: Cursor = {
  focus: { anchor: [], offset: 0 },
  enableReduceToTip: false,
  clipboard: undefined,
};

export const initialDocManagerPublicState: DocManagerPublicState = {
  doc: emptyDoc,
  mode: Mode.Normal,
  cursors: [initialCursor],
  cursorsOverlap: false,
};

export interface MinimalKeyboardEvent {
  key: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

function hasAltLike(
  ev: MinimalKeyboardEvent,
): ev is MinimalKeyboardEvent & ({ altKey: true } | { metaKey: true }) {
  return !!ev.altKey || !!ev.metaKey;
}

interface InsertHistoryEntry {
  insertState: InsertState;
}

export class DocManager {
  public readonly initialDoc: Doc;
  private cursors: Cursor[] = [initialCursor];
  private insertHistory: InsertHistoryEntry[] = [];
  private cursorHistory: Cursor[][] = [];
  private cursorRedoHistory: Cursor[][] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private lastDoc = emptyDoc;
  private insertState: InsertState | undefined;
  private getDocWithoutPlaceholdersNearCursors = memoize(
    getDocWithoutPlaceholdersNearCursors,
  );

  constructor(
    private doc: Doc,
    private _onUpdate: (publicState: DocManagerPublicState) => void,
  ) {
    this.initialDoc = doc;
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
    const other = new DocManager(this.initialDoc, this.onUpdate);
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
    if (this.mode === Mode.Normal) {
      if (ev.key === "i") {
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
      } else if (ev.key === "a") {
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
      } else if (ev.key === "d") {
        const result = multiCursorDelete({
          root: this.doc.root,
          cursors: this.cursors,
        });
        this.doc = { ...this.doc, root: result.root };
        this.cursors = result.cursors;
      } else if (ev.key === "s") {
        this.cursors = this.cursors.flatMap((cursor): Cursor[] => {
          const focus = flipEvenPathRangeForward(cursor.focus);
          if (
            isFocusOnEmptyListContent(this.doc.root, focus) ||
            !focus.offset
          ) {
            return [adjustPostActionCursor(cursor)];
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
              adjustPostActionCursor({
                ...cursor,
                focus: { anchor: path, offset: 0 },
              }),
            );
        });
      } else if (ev.key === "l" && !hasAltLike(ev)) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveLeaf({
              root: this.doc.root,
              cursor: cursor,
              direction: 1,
              mode: CursorMoveLeafMode.Move,
            }).cursor,
        );
      } else if (ev.key === "L" && !ev.ctrlKey) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveLeaf({
              root: this.doc.root,
              cursor: cursor,
              direction: 1,
              mode: CursorMoveLeafMode.ExtendSelection,
            }).cursor,
        );
      } else if (ev.key === "h" && !hasAltLike(ev)) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveLeaf({
              root: this.doc.root,
              cursor: cursor,
              direction: -1,
              mode: CursorMoveLeafMode.Move,
            }).cursor,
        );
      } else if (ev.key === "H" && !ev.ctrlKey) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveLeaf({
              root: this.doc.root,
              cursor: cursor,
              direction: -1,
              mode: CursorMoveLeafMode.ExtendSelection,
            }).cursor,
        );
      } else if (ev.key === "k") {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveInOut({
              root: this.doc.root,
              cursor: cursor,
              direction: CursorMoveInOutDirection.Out,
              bigStep: false,
            }).cursor,
        );
      } else if (ev.key === "K") {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveInOut({
              root: this.doc.root,
              cursor: cursor,
              direction: CursorMoveInOutDirection.Out,
              bigStep: true,
            }).cursor,
        );
      } else if ([")", "]", "}", ">"].includes(ev.key)) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveInOut({
              root: this.doc.root,
              cursor: cursor,
              direction: CursorMoveInOutDirection.Out,
              bigStep: true,
              delimiter: ev.key,
            }).cursor,
        );
      } else if (ev.key === "j") {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveInOut({
              root: this.doc.root,
              cursor: cursor,
              direction: CursorMoveInOutDirection.In,
              bigStep: true,
            }).cursor,
        );
      } else if (["(", "[", "{", "<"].includes(ev.key)) {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorMoveInOut({
              root: this.doc.root,
              cursor: cursor,
              direction: CursorMoveInOutDirection.In,
              bigStep: true,
              delimiter: ev.key,
            }).cursor,
        );
      } else if (ev.key === " ") {
        ev.preventDefault?.();
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorReduceSelection({
              root: this.doc.root,
              cursor: cursor,
              side: CursorReduceSelectionSide.JustExtended,
            }).cursor,
        );
      } else if (ev.key === "c") {
        this.cursors = this.cursors.map(
          (cursor) =>
            cursorCopy({
              root: this.doc.root,
              cursor: cursor,
            }).cursor,
        );
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
      this.cursors = this.cursors.map(
        (cursor) =>
          cursorReduceSelection({
            root: this.doc.root,
            cursor: cursor,
            side: CursorReduceSelectionSide.First,
          }).cursor,
      );
      this.onUpdate();
    } else if (this.mode === Mode.Normal && ev.key === "H" && ev.ctrlKey) {
      ev.preventDefault?.();
      this.cursors = this.cursors.map(
        (cursor) =>
          cursorMoveLeaf({
            root: this.doc.root,
            cursor: cursor,
            direction: -1,
            mode: CursorMoveLeafMode.ShrinkSelection,
          }).cursor,
      );
      this.onUpdate();
    } else if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "l" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      this.cursors = this.cursors.map(
        (cursor) =>
          cursorReduceSelection({
            root: this.doc.root,
            cursor: cursor,
            side: CursorReduceSelectionSide.Last,
          }).cursor,
      );
      this.onUpdate();
    } else if (this.mode === Mode.Normal && ev.key === "L" && ev.ctrlKey) {
      ev.preventDefault?.();
      this.cursors = this.cursors.map(
        (cursor) =>
          cursorMoveLeaf({
            root: this.doc.root,
            cursor: cursor,
            direction: 1,
            mode: CursorMoveLeafMode.ShrinkSelection,
          }).cursor,
      );
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
        cursorBeforePositionsAdjustedForPlaceholderRemoval.map((beforePos) => ({
          beforePos,
          text: this.insertState!.text,
        }));

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

      for (const node of checkedInsertion.newNodesByOldPlaceholderNodes.values()) {
        // HACK mutating docWithInsertBeforeFormatting
        node.isPlaceholder = true;
      }

      this.cursors = this.cursors.map((cursor, i) => ({
        ...cursor,
        focus: checkedInsertion.insertionPathRanges[i],
      }));

      // TODO format

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

    this.cursors = this.cursors.map((cursor) => ({
      ...cursor,
      focus: asEvenPathRange(
        normalizeFocusIn(this.doc.root, asUnevenPathRange(cursor.focus)),
      ),
    }));

    if (this.mode === Mode.Insert) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.insertHistory = [];
      }
    }
    this.lastMode = this.mode;

    if (docChanged) {
      this.updateDocText();
      this.cursorHistory = [];
      this.cursorRedoHistory = [];
    }

    this.cursorHistory.push(this.cursors);

    this.lastDoc = this.doc;

    this.reportUpdate();
  }

  private reportUpdate() {
    let doc = this.doc;
    if (this.insertState) {
      const result = this.getDocWithoutPlaceholdersNearCursors(
        this.doc,
        this.insertState.beforePos,
      );
      doc = getDocWithInsertions(
        result.doc,
        this.insertState.beforePos.map((beforePos) => ({
          beforePos,
          text: this.insertState!.text,
        })),
      );
    }
    this._onUpdate({
      doc,
      mode: this.mode,
      cursors: this.cursors,
      cursorsOverlap: checkTextRangesOverlap(
        this.cursors.map((c) => textRangeFromFocus(this.doc.root, c.focus)),
      ),
    });
  }

  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
  }
}
