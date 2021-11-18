import { css } from "@emotion/css";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { renderLinesFromDoc } from "../logic/render";
import { SimpleLines } from "./simple-lines";
interface Props {
  initialDoc: Doc;
  onSave: (doc: Doc) => void;
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
export const LinearEditor = ({ initialDoc, onSave }: Props) => {
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
  const lines = renderLinesFromDoc(doc, mode, cursors, queuedCursors);
  return (
    <div>
      <div
        ref={codeDivRef}
        className={styles.doc}
        tabIndex={0}
        onKeyPress={wrapThrowRestore(docManager, (ev) =>
          docManager.onKeyPress(ev.nativeEvent),
        )}
        onKeyDown={wrapThrowRestore(docManager, (ev) => {
          if (mode === Mode.Normal && ev.key === "s" && ev.ctrlKey) {
            ev.preventDefault();
            ev.stopPropagation();
            onSave(doc);
          } else {
            docManager.onKeyDown(ev.nativeEvent);
          }
        })}
        onKeyUp={wrapThrowRestore(docManager, (ev) =>
          docManager.onKeyUp(ev.nativeEvent),
        )}
      >
        {doc.text.trim() ? (
          <SimpleLines lines={lines} />
        ) : (
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
