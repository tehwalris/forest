import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import {
  Doc,
  EvenPathRange,
  FocusKind,
  Node,
  NodeKind,
  Path,
} from "../logic/interfaces";
import { docFromAst } from "../logic/node-from-ts";
import { astFromTypescriptFileContent } from "../logic/parse";
import { asEvenPathRange } from "../logic/path-utils";
import { nodeTryGetDeepestByPath } from "../logic/tree-utils/access";
import { unreachable } from "../logic/util";

const exampleFile = `
  export const handlers: {
    [key: string]: (() => void) | undefined;
  } = {
    Enter: node.actions.setVariant
      ? tryAction("setVariant", (n) => n.id, true)
      : tryAction("setFromString"),
    "ctrl-d": tryDeleteChild,
    "ctrl-c": () => copyNode(node),
    "ctrl-p": copiedNode && tryAction("replace", (n) => n.id),
    "ctrl-f": editFlags,
    "ctrl-4": () =>
      setMarks({
        ...marks,
        TODO: idPathFromParentIndexEntry(parentIndexEntry),
      }),
  };
`;

const initialDoc = docFromAst(astFromTypescriptFileContent(exampleFile));

const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const styles = {
  doc: css`
    margin: 5px;
  `,
  modeLine: css`
    margin: 5px;
    margin-top: 15px;
  `,
  cursorSpan: css`
    position: relative;
    background: red;
  `,
  cursorDiv: css`
    --thickness: 2px;
    --overhang: 1px;
    position: absolute;
    background: black;
    width: 2px;
    height: calc(100% + 2 * var(--overhang));
    top: calc(-1 * var(--overhang));
    left: calc(var(--thickness) / 2);
    animation: ${pulse} 1s ease infinite;
  `,
};

enum CharSelection {
  None = 0,
  Normal = 1,
  Tip = 2,
  Cursor = 3,
}

function setCharSelections({
  selectionsByChar,
  node,
  focus,
  isTipOfFocus,
}: {
  selectionsByChar: Uint8Array;
  node: Node;
  focus: EvenPathRange | undefined;
  isTipOfFocus: boolean;
}) {
  const focused = focus !== undefined && focus.anchor.length === 0;
  let focusedChildRange: [number, number] | undefined;
  let tipOfFocusIndex: number | undefined;
  if (focus?.anchor.length) {
    const offset = focus.anchor.length === 1 ? focus.offset : 0;
    focusedChildRange = [focus.anchor[0], focus.anchor[0] + offset];
    if (focus.anchor.length === 1) {
      tipOfFocusIndex = focusedChildRange[1];
    }
    if (focusedChildRange[0] > focusedChildRange[1]) {
      focusedChildRange = [focusedChildRange[1], focusedChildRange[0]];
    }
  }

  if (focused) {
    selectionsByChar.fill(
      isTipOfFocus ? CharSelection.Tip : CharSelection.Normal,
      node.pos,
      node.end,
    );
  }

  if (node.kind === NodeKind.List) {
    for (const [i, c] of node.content.entries()) {
      setCharSelections({
        selectionsByChar,
        node: c,
        focus:
          focusedChildRange &&
          i >= focusedChildRange[0] &&
          i <= focusedChildRange[1]
            ? {
                anchor: focus!.anchor.slice(1),
                offset: focus!.offset,
              }
            : undefined,
        isTipOfFocus: i === tipOfFocusIndex,
      });
    }
  }
}

interface DocRenderLine {
  regions: DocRenderRegion[];
  pos: number;
  end: number;
}

interface DocRenderRegion {
  text: string;
  selection: CharSelection;
  pos: number;
  end: number;
}

function splitDocRenderRegions(
  text: string,
  selectionsByChar: Uint8Array,
  linePos: number,
): DocRenderRegion[] {
  if (text.length !== selectionsByChar.length) {
    throw new Error("text and selectionsByChar must have same length");
  }

  if (!selectionsByChar.length) {
    return [];
  }

  const regions: DocRenderRegion[] = [];
  let pos = 0;
  const pushRegion = (end: number) => {
    regions.push({
      text: text.slice(pos, end),
      selection: selectionsByChar[pos],
      pos: pos + linePos,
      end: end + linePos,
    });
    pos = end;
  };
  for (const [i, selection] of selectionsByChar.entries()) {
    if (selection !== selectionsByChar[pos]) {
      pushRegion(i);
    }
    if (i + 1 === selectionsByChar.length) {
      pushRegion(i + 1);
    }
  }
  return regions;
}

function getBeforePos(doc: Doc, beforePath: Path): number {
  const deepest = nodeTryGetDeepestByPath(doc.root, beforePath);
  if (deepest.path.length === beforePath.length) {
    return deepest.node.pos;
  }
  let pos = deepest.node.end;
  if (deepest.node.kind === NodeKind.List) {
    pos -= deepest.node.delimiters[1].length;
  }
  return pos;
}

function insertDocRenderCursor(lines: DocRenderLine[], beforePos: number) {
  if (!lines.length) {
    return;
  }

  const targetLine =
    lines.find((l) => l.pos <= beforePos && l.end >= beforePos) ||
    lines[lines.length - 1];

  let beforeOrAtIndex = targetLine.regions.findIndex(
    (r) => r.pos <= beforePos && r.end >= beforePos,
  );
  if (beforeOrAtIndex === -1) {
    beforeOrAtIndex = targetLine.regions.length;
  }
  let oldRegion: DocRenderRegion | undefined;
  if (beforeOrAtIndex < targetLine.regions.length) {
    oldRegion = targetLine.regions[beforeOrAtIndex];
  }

  let splitRegion: [DocRenderRegion, DocRenderRegion] | undefined;
  if (oldRegion && oldRegion.pos < beforePos) {
    const leftLength = beforePos - oldRegion.pos;
    splitRegion = [
      {
        text: oldRegion.text.slice(0, leftLength),
        selection: oldRegion.selection,
        pos: oldRegion.pos,
        end: oldRegion.pos + leftLength,
      },
      {
        text: oldRegion.text.slice(leftLength),
        selection: oldRegion.selection,
        pos: oldRegion.pos + leftLength,
        end: oldRegion.end,
      },
    ];
  }

  const cursorRegion: DocRenderRegion = {
    text: "",
    selection: CharSelection.Cursor,
    pos: beforePos,
    end: beforePos,
  };

  if (splitRegion) {
    targetLine.regions.splice(
      beforeOrAtIndex,
      1,
      splitRegion[0],
      cursorRegion,
      splitRegion[1],
    );
  } else {
    targetLine.regions.splice(beforeOrAtIndex, 0, cursorRegion);
  }
}

function renderDoc({
  doc,
  evenFocusRange,
  cursorBeforePath,
}: {
  doc: Doc;
  evenFocusRange: EvenPathRange | undefined;
  cursorBeforePath: Path | undefined;
}): React.ReactNode {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelections({
    selectionsByChar,
    node: doc.root,
    focus: evenFocusRange,
    isTipOfFocus: false,
  });

  const lines: DocRenderLine[] = [];
  let pos = 0;
  for (const lineText of doc.text.split("\n")) {
    const line = {
      regions: splitDocRenderRegions(
        lineText,
        selectionsByChar.subarray(pos, pos + lineText.length),
        pos,
      ),
      pos,
      end: pos + lineText.length + 1,
    };
    if (line.regions.length || lines.length) {
      lines.push(line);
    }
    pos = line.end;
  }
  while (lines.length && !lines[lines.length - 1].regions.length) {
    lines.pop();
  }

  if (cursorBeforePath) {
    insertDocRenderCursor(lines, getBeforePos(doc, cursorBeforePath));
  }

  const backgroundsBySelection: { [K in CharSelection]: string | undefined } = {
    [CharSelection.None]: undefined,
    [CharSelection.Normal]: "rgba(11, 83, 255, 0.15)",
    [CharSelection.Tip]: "rgba(11, 83, 255, 0.37)",
    [CharSelection.Cursor]: undefined,
  };

  return (
    <div style={{ whiteSpace: "pre" }}>
      {lines.map((line, iLine) => (
        <div key={iLine}>
          {!line.regions.length && <br />}
          {line.regions.map((region, iRegion) => (
            <span
              key={iRegion}
              style={{ background: backgroundsBySelection[region.selection] }}
              className={
                region.selection === CharSelection.Cursor
                  ? styles.cursorSpan
                  : undefined
              }
            >
              {region.selection === CharSelection.Cursor ? (
                <div className={styles.cursorDiv} />
              ) : (
                region.text
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export const LinearEditor = () => {
  const [{ doc, focus, mode }, setPublicState] =
    useState<DocManagerPublicState>(initialDocManagerPublicState);
  const [docManager, setDocManager] = useState(
    new DocManager(initialDoc, setPublicState),
  );
  useEffect(() => {
    setDocManager((oldDocManager) => {
      const newDocManager = new DocManager(initialDoc, setPublicState);
      (newDocManager as any).doc = (oldDocManager as any).doc;
      (newDocManager as any).history = (oldDocManager as any).history;
      return newDocManager;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DocManager]);
  useEffect(() => {
    docManager.forceUpdate();
  }, [docManager]);

  useEffect(() => {
    const options: EventListenerOptions = { capture: true };
    document.addEventListener("keypress", docManager.onKeyPress, options);
    document.addEventListener("keydown", docManager.onKeyDown, options);
    document.addEventListener("keyup", docManager.onKeyUp, options);
    return () => {
      document.removeEventListener("keypress", docManager.onKeyPress, options);
      document.removeEventListener("keydown", docManager.onKeyDown, options);
      document.removeEventListener("keyup", docManager.onKeyUp, options);
    };
  }, [docManager]);

  let evenFocusRange: EvenPathRange | undefined;
  let cursorBeforePath: Path | undefined;
  if (focus.kind === FocusKind.Range) {
    evenFocusRange = asEvenPathRange(focus.range);
  } else if (focus.kind === FocusKind.Location) {
    cursorBeforePath = focus.before;
  } else {
    return unreachable(focus);
  }

  return (
    <div>
      <div className={styles.doc}>
        {renderDoc({ doc, evenFocusRange, cursorBeforePath })}
      </div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      <pre>
        {JSON.stringify(
          {
            focus,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
};
