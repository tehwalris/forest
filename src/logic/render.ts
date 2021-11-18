import * as React from "react";
import { Cursor } from "../logic/cursor/interfaces";
import { Mode } from "../logic/doc-manager";
import { textRangeFromFocus } from "../logic/focus";
import { Doc, EvenPathRange, ListNode } from "../logic/interfaces";
import { getPathToTip } from "../logic/path-utils";
import { nodeGetByPath, nodeVisitDeep } from "../logic/tree-utils/access";
export enum CharSelection {
  Normal = 1,
  Tip = 2,
  Queued = 4,
  Placeholder = 8,
  PrimaryCursor = 16,
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
  enableReduceToTip,
  isPrimaryCursor,
}: {
  selectionsByChar: Uint8Array;
  root: ListNode;
  focus: EvenPathRange;
  enableReduceToTip: boolean;
  isPrimaryCursor: boolean;
}) {
  const focusRange = textRangeFromFocus(root, focus);
  fillBitwiseOr(
    selectionsByChar,
    isPrimaryCursor
      ? (CharSelection.Normal | CharSelection.PrimaryCursor)
      : CharSelection.Normal,
    focusRange.pos,
    focusRange.end,
  );
  const tipNode = nodeGetByPath(root, getPathToTip(focus));
  if (tipNode && enableReduceToTip) {
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
export interface DocRenderLine {
  regions: DocRenderRegion[];
}
export interface DocRenderRegion {
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
export function getStyleForSelection(
  selection: CharSelection,
): React.CSSProperties {
  if (selection & (CharSelection.Normal | CharSelection.Tip)) {
    selection = selection & ~CharSelection.Queued;
  }
  const stylesBySelection: {
    [K in CharSelection]: React.CSSProperties;
  } = {
    [CharSelection.Normal]: { background: "rgba(11, 83, 255, 0.37)" },
    [CharSelection.Tip]: { background: "rgba(120, 83, 150, 0.37)" },
    [CharSelection.Queued]: { background: "rgb(189, 189, 189)" },
    [CharSelection.Placeholder]: { color: "#888" },
    [CharSelection.PrimaryCursor]: {},
  };
  const style: React.CSSProperties = {};
  for (let i = 0; i < numCharSelections; i++) {
    if (selection & (1 << i)) {
      Object.assign(style, stylesBySelection[(1 << i) as CharSelection]);
    }
  }
  return style;
}
export function renderLinesFromDoc(
  doc: Doc,
  mode: Mode,
  cursors: Cursor[],
  queuedCursors: Cursor[],
): DocRenderLine[] {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelectionsForPlaceholders({ selectionsByChar, root: doc.root });
  if (mode === Mode.Normal) {
    for (const [iCursor, cursor] of cursors.entries()) {
      setCharSelectionsForFocus({
        selectionsByChar,
        root: doc.root,
        focus: cursor.focus,
        enableReduceToTip: cursor.enableReduceToTip,
        isPrimaryCursor: iCursor === 0,
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
  return lines;
}
