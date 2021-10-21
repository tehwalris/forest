import { css } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import { Doc, EvenPathRange, Node, NodeKind } from "../logic/interfaces";
import { docFromAst } from "../logic/node-from-ts";
import { astFromTypescriptFileContent } from "../logic/parse";

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

const styles = {
  doc: css`
    margin: 5px;
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

function getStyleForSelection(selection: CharSelection): React.CSSProperties {
  const stylesBySelection: { [K in CharSelection]: React.CSSProperties } = {
    [CharSelection.Normal]: { background: "rgba(11, 83, 255, 0.15)" },
    [CharSelection.Tip]: { background: "rgba(11, 83, 255, 0.37)" },
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

function renderDoc(doc: Doc, focus: EvenPathRange): React.ReactNode {
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
            <span key={iRegion} style={getStyleForSelection(region.selection)}>
              {region.text}
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

  return (
    <div>
      <div className={styles.doc}>{renderDoc(doc, focus)}</div>
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
