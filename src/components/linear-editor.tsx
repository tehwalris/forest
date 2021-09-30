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
console.log("walrus")
  .test( 
    "bla",
    test,
    1234 + 5,
   );

foo();
if (Date.now() % 100 == 0) {
  console.log("lucky you");
} else if (walrus) {
  console.log("even better");
} else {
  throw new Error("not so lucky");
}
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
  None = 0,
  Normal = 1,
  Tip = 2,
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

  const backgroundsBySelection: { [K in CharSelection]: string | undefined } = {
    [CharSelection.None]: undefined,
    [CharSelection.Normal]: "rgba(11, 83, 255, 0.15)",
    [CharSelection.Tip]: "rgba(11, 83, 255, 0.37)",
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
            >
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
