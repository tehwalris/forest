import { css } from "@emotion/css";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import { Doc, EvenPathRange, Node, NodeKind } from "../logic/interfaces";

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
};

enum CharSelection {
  Normal = 1,
  Tip = 2,
  Placeholder = 4,
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

  let fillValue = 0;
  if (focused) {
    fillValue |= isTipOfFocus ? CharSelection.Tip : CharSelection.Normal;
  }
  if (node.isPlaceholder) {
    fillValue |= CharSelection.Placeholder;
  }
  fillBitwiseOr(selectionsByChar, fillValue, node.pos, node.end);

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

  const stylesBySelection: { [K in CharSelection]: React.CSSProperties } = {
    [CharSelection.Normal]: { background: "rgba(11, 83, 255, 0.37)" },
    [CharSelection.Tip]: { background: "rgba(120, 83, 150, 0.37)" },
    [CharSelection.Placeholder]: { color: "#888" },
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
  focus: EvenPathRange,
  enableReduceToTip: boolean,
): React.ReactNode {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelections({
    selectionsByChar,
    node: doc.root,
    focus,
    isTipOfFocus: false,
  });

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

  const [{ doc, focus, mode, enableReduceToTip }, setPublicState] =
    useState<DocManagerPublicState>(initialDocManagerPublicState);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {renderDoc(doc, focus, enableReduceToTip)}
        {!doc.text.trim() && (
          <div style={{ opacity: 0.5, userSelect: "none" }}>
            (empty document)
          </div>
        )}
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
