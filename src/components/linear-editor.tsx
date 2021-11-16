import { css } from "@emotion/css";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Cursor } from "../logic/cursor/interfaces";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import { textRangeFromFocus } from "../logic/focus";
import { Doc, EvenPathRange, ListNode } from "../logic/interfaces";
import { getPathToTip } from "../logic/path-utils";
import { nodeGetByPath, nodeVisitDeep } from "../logic/tree-utils/access";
interface Props {
  initialDoc: Doc;
}
const styles = {
  doc: css`
    margin: 5px;

    &:focus {
      outline: 1px dotted black;
    }

    &:not(:focus) {
      filter: grayscale(1);
    }
  `,
  modeLine: css`
    margin: 5px;
    margin-top: 15px;
  `,
  overlapWarning: css`
    margin: 5px;
    margin-top: 15px;
    color: red;
  `,
};
enum CharSelection {
  Normal = 1,
  Tip = 2,
  Queued = 4,
  Placeholder = 8,
}
const numCharSelections = Object.entries(CharSelection).length / 2;
for (let i = 0; i < numCharSelections; i++) {
  if (!CharSelection[1 << i]) {
    throw new Error("CharSelection is invalid");
  }
}
function fillBitwiseOr(
  data: Uint8Array,
  value: number,
  pos: number,
  end: number,
) {
  if (value === 0) {
    return;
  }
  for (let i = pos; i < end; i++) {
    data[i] |= value;
  }
}
function setCharSelectionsForFocus({
  selectionsByChar,
  root,
  focus,
}: {
  selectionsByChar: Uint8Array;
  root: ListNode;
  focus: EvenPathRange;
}) {
  const focusRange = textRangeFromFocus(root, focus);
  fillBitwiseOr(
    selectionsByChar,
    CharSelection.Normal,
    focusRange.pos,
    focusRange.end,
  );
  const tipNode = nodeGetByPath(root, getPathToTip(focus));
  if (tipNode) {
    fillBitwiseOr(
      selectionsByChar,
      CharSelection.Tip,
      tipNode.pos,
      tipNode.end,
    );
  }
}
function setCharSelectionsForPlaceholders({
  selectionsByChar,
  root,
}: {
  selectionsByChar: Uint8Array;
  root: ListNode;
}) {
  nodeVisitDeep(root, (node) => {
    if (!node.isPlaceholder) {
      return;
    }
    fillBitwiseOr(
      selectionsByChar,
      CharSelection.Placeholder,
      node.pos,
      node.end,
    );
  });
}
interface DocRenderLine {
  regions: DocRenderRegion[];
}
interface DocRenderRegion {
  text: string;
  selection: CharSelection;
}
function splitDocRenderRegions(
  text: string,
  selectionsByChar: Uint8Array,
): DocRenderRegion[] {
  if (text.length !== selectionsByChar.length) {
    throw new Error("text and selectionsByChar must have same length");
  }
  if (!selectionsByChar.length) {
    return [];
  }
  const regions: DocRenderRegion[] = [];
  let start = 0;
  const pushRegion = (end: number) => {
    regions.push({
      text: text.slice(start, end),
      selection: selectionsByChar[start],
    });
    start = end;
  };
  for (const [i, selection] of selectionsByChar.entries()) {
    if (selection !== selectionsByChar[start]) {
      pushRegion(i);
    }
    if (i + 1 === selectionsByChar.length) {
      pushRegion(i + 1);
    }
  }
  return regions;
}
function getStyleForSelection(
  selection: CharSelection,
  enableReduceToTip: boolean,
): React.CSSProperties {
  if (!enableReduceToTip && selection & CharSelection.Tip) {
    selection = (selection & ~CharSelection.Tip) | CharSelection.Normal;
  }
  if (selection & (CharSelection.Normal | CharSelection.Tip)) {
    selection = selection & ~CharSelection.Queued;
  }
  const stylesBySelection: {
    [K in CharSelection]: React.CSSProperties;
  } = {
    [CharSelection.Normal]: { background: "rgba(11, 83, 255, 0.37)" },
    [CharSelection.Tip]: { background: "rgba(120, 83, 150, 0.37)" },
    [CharSelection.Placeholder]: { color: "#888" },
    [CharSelection.Queued]: { background: "rgb(189, 189, 189)" },
  };
  const style: React.CSSProperties = {};
  for (let i = 0; i < numCharSelections; i++) {
    if (selection & (1 << i)) {
      Object.assign(style, stylesBySelection[(1 << i) as CharSelection]);
    }
  }
  return style;
}
function renderDoc(
  doc: Doc,
  mode: Mode,
  cursors: Cursor[],
  queuedCursors: Cursor[],
): React.ReactNode {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelectionsForPlaceholders({ selectionsByChar, root: doc.root });
  if (mode === Mode.Normal) {
    for (const cursor of cursors) {
      setCharSelectionsForFocus({
        selectionsByChar,
        root: doc.root,
        focus: cursor.focus,
      });
    }
    for (const cursor of queuedCursors) {
      const focusRange = textRangeFromFocus(doc.root, cursor.focus);
      fillBitwiseOr(
        selectionsByChar,
        CharSelection.Queued,
        focusRange.pos,
        focusRange.end,
      );
    }
  }
  const enableReduceToTip = cursors.some((c) => c.enableReduceToTip);
  const lines: DocRenderLine[] = [];
  let pos = 0;
  for (const lineText of doc.text.split("\n")) {
    const line = {
      regions: splitDocRenderRegions(
        lineText,
        selectionsByChar.subarray(pos, pos + lineText.length),
      ),
    };
    if (line.regions.length || lines.length) {
      lines.push(line);
    }
    pos += lineText.length + 1;
  }
  while (lines.length && !lines[lines.length - 1].regions.length) {
    lines.pop();
  }
  return (
    <div style={{ whiteSpace: "pre" }}>
      {lines.map((line, iLine) => (
        <div key={iLine}>
          {!line.regions.length && <br />}
          {line.regions.map((region, iRegion) => (
            <span
              key={iRegion}
              style={getStyleForSelection(region.selection, enableReduceToTip)}
            >
              {region.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
function wrapThrowRestore<A extends any[]>(
  docManager: DocManager,
  f: (...args: A) => void,
): (...args: A) => void {
  return (...args) => {
    const backup = docManager.clone();
    try {
      f(...args);
    } catch (err) {
      console.error(err);
      docManager.fillFromOther(backup);
      alert(
        "Your command crashed the editor. Restored to the state before the crash. See developer console for stacktrace.",
      );
    }
  };
}
export const LinearEditor = ({ initialDoc }: Props) => {
  const focusedCodeDivRef = useRef<HTMLDivElement | null>(null);
  const codeDivRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      codeDivRef.current &&
      codeDivRef.current !== focusedCodeDivRef.current
    ) {
      codeDivRef.current.focus();
      focusedCodeDivRef.current = codeDivRef.current;
    }
  });
  const [
    { doc, mode, cursors, cursorsOverlap, queuedCursors },
    setPublicState,
  ] = useState<DocManagerPublicState>(initialDocManagerPublicState);
  const [docManager, setDocManager] = useState(
    new DocManager(initialDoc, setPublicState),
  );
  useEffect(() => {
    setDocManager((oldDocManager) => {
      const newDocManager = new DocManager(initialDoc, setPublicState);
      if (newDocManager.initialDoc === oldDocManager.initialDoc) {
        (newDocManager as any).doc = (oldDocManager as any).doc;
        (newDocManager as any).history = (oldDocManager as any).history;
      } else if (codeDivRef.current) {
        codeDivRef.current.focus();
        focusedCodeDivRef.current = codeDivRef.current;
      }
      return newDocManager;
    });
  }, [DocManager, initialDoc]);
  useEffect(() => {
    docManager.forceUpdate();
    return () => {
      docManager.disableUpdates();
    };
  }, [docManager]);
  return (
    <div>
      <div
        ref={codeDivRef}
        className={styles.doc}
        tabIndex={0}
        onKeyPress={wrapThrowRestore(docManager, (ev) =>
          docManager.onKeyPress(ev.nativeEvent),
        )}
        onKeyDown={wrapThrowRestore(docManager, (ev) =>
          docManager.onKeyDown(ev.nativeEvent),
        )}
        onKeyUp={wrapThrowRestore(docManager, (ev) =>
          docManager.onKeyUp(ev.nativeEvent),
        )}
      >
        {renderDoc(doc, mode, cursors, queuedCursors)}
        {!doc.text.trim() && (
          <div style={{ opacity: 0.5, userSelect: "none" }}>
            (empty document)
          </div>
        )}
      </div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      {cursorsOverlap && (
        <div className={styles.overlapWarning}>Warning: cursors overlap</div>
      )}
    </div>
  );
};
