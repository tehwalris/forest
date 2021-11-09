import { cursorCopy } from "./cursor/copy";
import { Cursor } from "./cursor/interfaces";
import {
  cursorMoveInOut,
  CursorMoveInOutDirection,
} from "./cursor/move-in-out";
import { cursorMoveLeaf, CursorMoveLeafMode } from "./cursor/move-leaf";
import {
  cursorReduceSelection,
  CursorReduceSelectionSide,
} from "./cursor/reduce-selection";
import { emptyDoc } from "./doc-utils";
import { normalizeFocusIn } from "./focus";
import { Doc, InsertState, UnevenPathRange } from "./interfaces";
import { memoize } from "./memoize";
import { Clipboard } from "./paste";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqual,
  flipEvenPathRangeForward,
} from "./path-utils";
import {
  getDocWithAllPlaceholders,
  getDocWithoutPlaceholdersNearCursor,
} from "./placeholders";
import { getDocWithInsert } from "./text";
import { nodeTryGetDeepestByPath } from "./tree-utils/access";
import { withoutInvisibleNodes } from "./without-invisible";

export enum Mode {
  Normal,
  InsertBefore,
  InsertAfter,
}

export interface DocManagerPublicState {
  doc: Doc;
  mode: Mode;
  cursors: Cursor[];
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
  doc: Doc;
  focus: UnevenPathRange;
  insertState: InsertState;
}

interface FocusHistoryEntry {
  focus: UnevenPathRange;
  enableReduceToTip: boolean;
}

export class DocManager {
  public readonly initialDoc: Doc;
  private focus: UnevenPathRange = { anchor: [], tip: [] };
  private insertHistory: InsertHistoryEntry[] = [];
  private focusHistory: FocusHistoryEntry[] = [];
  private focusRedoHistory: FocusHistoryEntry[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private lastDoc = emptyDoc;
  private lastFocus = this.focus;
  private insertState: InsertState | undefined;
  private enableReduceToTip = false;
  private nextEnableReduceToTip = false;
  private getDocWithoutPlaceholdersNearCursor = memoize(
    getDocWithoutPlaceholdersNearCursor,
  );
  private clipboard: Clipboard | undefined;

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
      if (ev.key === "l" && !hasAltLike(ev)) {
        const result = cursorMoveLeaf({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: 1,
          mode: CursorMoveLeafMode.Move,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "L" && !ev.ctrlKey) {
        const result = cursorMoveLeaf({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: 1,
          mode: CursorMoveLeafMode.ExtendSelection,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "h" && !hasAltLike(ev)) {
        const result = cursorMoveLeaf({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: -1,
          mode: CursorMoveLeafMode.Move,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "H" && !ev.ctrlKey) {
        const result = cursorMoveLeaf({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: -1,
          mode: CursorMoveLeafMode.ExtendSelection,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "k") {
        const result = cursorMoveInOut({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: CursorMoveInOutDirection.Out,
          bigStep: false,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "K") {
        const result = cursorMoveInOut({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: CursorMoveInOutDirection.Out,
          bigStep: true,
        });
        this.setFromCursor(result.cursor);
      } else if ([")", "]", "}", ">"].includes(ev.key)) {
        const result = cursorMoveInOut({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: CursorMoveInOutDirection.Out,
          bigStep: true,
          delimiter: ev.key,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "j") {
        const result = cursorMoveInOut({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: CursorMoveInOutDirection.In,
          bigStep: true,
        });
        this.setFromCursor(result.cursor);
      } else if (["(", "[", "{", "<"].includes(ev.key)) {
        const result = cursorMoveInOut({
          root: this.doc.root,
          cursor: this.getCursor(),
          direction: CursorMoveInOutDirection.In,
          bigStep: true,
          delimiter: ev.key,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === " ") {
        ev.preventDefault?.();
        const result = cursorReduceSelection({
          root: this.doc.root,
          cursor: this.getCursor(),
          side: CursorReduceSelectionSide.JustExtended,
        });
        this.setFromCursor(result.cursor);
      } else if (ev.key === "c") {
        const result = cursorCopy({
          root: this.doc.root,
          cursor: this.getCursor(),
        });
        this.setFromCursor(result.cursor);
      }
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
      const result = cursorReduceSelection({
        root: this.doc.root,
        cursor: this.getCursor(),
        side: CursorReduceSelectionSide.First,
      });
      if (result.didReduce) {
        this.setFromCursor(result.cursor);
        this.onUpdate();
      }
    } else if (this.mode === Mode.Normal && ev.key === "H" && ev.ctrlKey) {
      ev.preventDefault?.();
      const result = cursorMoveLeaf({
        root: this.doc.root,
        cursor: this.getCursor(),
        direction: -1,
        mode: CursorMoveLeafMode.ShrinkSelection,
      });
      if (result.didMove) {
        this.setFromCursor(result.cursor);
      }
      this.onUpdate();
    } else if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "l" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      const result = cursorReduceSelection({
        root: this.doc.root,
        cursor: this.getCursor(),
        side: CursorReduceSelectionSide.Last,
      });
      if (result.didReduce) {
        this.setFromCursor(result.cursor);
        this.onUpdate();
      }
    } else if (this.mode === Mode.Normal && ev.key === "L" && ev.ctrlKey) {
      ev.preventDefault?.();
      const result = cursorMoveLeaf({
        root: this.doc.root,
        cursor: this.getCursor(),
        direction: 1,
        mode: CursorMoveLeafMode.ShrinkSelection,
      });
      if (result.didMove) {
        this.setFromCursor(result.cursor);
      }
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Backspace"
    ) {
      if (this.insertHistory.length < 2) {
        return;
      }
      this.insertHistory.pop();
      const old = this.insertHistory.pop()!;
      this.doc = old.doc;
      this.focus = old.focus;
      this.insertState = old.insertState;
      this.onUpdate();
    }
  };

  onKeyUp = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      ev.stopPropagation?.();
      ev.preventDefault?.();
    }
  };

  private getCursor(): Cursor {
    return {
      focus: asEvenPathRange(this.focus),
      enableReduceToTip: this.enableReduceToTip,
      clipboard: this.clipboard,
    };
  }

  private setFromCursor(cursor: Cursor) {
    this.focus = asUnevenPathRange(cursor.focus);
    this.nextEnableReduceToTip = cursor.enableReduceToTip;
    this.clipboard = cursor.clipboard;
  }

  private onUpdate() {
    const docChanged = this.doc !== this.lastDoc;

    if (this.mode === Mode.Normal && docChanged) {
      this.removeInvisibleNodes();
    }

    this.focus = normalizeFocusIn(
      this.doc.root,
      asUnevenPathRange(asEvenPathRange(this.focus)),
    );

    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.insertHistory = [];
      }
      this.insertHistory.push({
        doc: this.doc,
        focus: this.focus,
        insertState: this.insertState,
      });
    }
    this.lastMode = this.mode;

    if (docChanged) {
      this.updateDocText();
      this.focusHistory = [];
      this.focusRedoHistory = [];
    }

    if (
      !this.focusHistory.length ||
      !evenPathRangesAreEqual(
        asEvenPathRange(this.focusHistory[this.focusHistory.length - 1].focus),
        asEvenPathRange(this.focus),
      )
    ) {
      this.focusHistory.push({
        focus: this.focus,
        enableReduceToTip: this.enableReduceToTip,
      });
    }

    if (
      this.nextEnableReduceToTip &&
      (!evenPathRangesAreEqual(
        flipEvenPathRangeForward(asEvenPathRange(this.focus)),
        flipEvenPathRangeForward(asEvenPathRange(this.lastFocus)),
      ) ||
        this.enableReduceToTip)
    ) {
      this.enableReduceToTip = this.nextEnableReduceToTip;
    } else {
      this.enableReduceToTip = false;
    }
    this.nextEnableReduceToTip = false;
    this.lastFocus = this.focus;

    this.lastDoc = this.doc;

    this.reportUpdate();
  }

  private reportUpdate() {
    let doc = this.doc;
    if (this.insertState) {
      const result = this.getDocWithoutPlaceholdersNearCursor(
        this.doc,
        this.insertState.beforePos,
      );
      doc = getDocWithInsert(result.doc, {
        beforePos: result.cursorBeforePos,
        text: this.insertState.text,
      });
    }
    this._onUpdate({
      doc,
      mode: this.mode,
      cursors: [this.getCursor()],
    });
  }

  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
    // HACK makeNodeValidTs makes replaces some single item lists by their only item.
    // This is the easiest way to make the focus valid again, even though it's not very clean.
    this.fixFocus();
  }

  private fixFocus() {
    this.focus = {
      anchor: nodeTryGetDeepestByPath(this.doc.root, this.focus.anchor).path,
      tip: nodeTryGetDeepestByPath(this.doc.root, this.focus.tip).path,
    };
  }

  private removeInvisibleNodes() {
    const anchorResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.anchor,
      offset: 0,
    });
    const tipResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.tip,
      offset: 0,
    });
    this.doc = anchorResult.doc;
    this.focus = {
      anchor: anchorResult.focus.anchor,
      tip: tipResult.focus.anchor,
    };
  }
}
