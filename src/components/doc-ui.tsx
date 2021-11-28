import { css } from "@emotion/css";
import * as React from "react";
import {
  CursorOverlapKind,
  DocManager,
  DocManagerPublicState,
  Mode,
  MultiCursorMode,
} from "../logic/doc-manager";
import { renderLinesFromDoc } from "../logic/render";
import { FollowLines } from "./follow-lines";
type KeyboardEventHandler = (
  ev: React.KeyboardEvent<HTMLDivElement>,
  handleWithDocManager: () => void,
) => void;
interface Props {
  docManager: DocManager;
  state: DocManagerPublicState;
  codeDivRef?: React.RefObject<HTMLDivElement>;
  onKeyPress?: KeyboardEventHandler;
  onKeyDown?: KeyboardEventHandler;
  onKeyUp?: KeyboardEventHandler;
}
const defaultKeyboardEventHandler: KeyboardEventHandler = (
  _ev,
  handleWithDocManager,
) => {
  handleWithDocManager();
};
const styles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,
  doc: css`
    flex: 1 1 100px;
    overflow: hidden;
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
export const DocUi = ({
  docManager,
  state: { doc, mode, multiCursorMode, cursors, cursorsOverlap, queuedCursors },
  codeDivRef,
  onKeyPress = defaultKeyboardEventHandler,
  onKeyDown = defaultKeyboardEventHandler,
  onKeyUp = defaultKeyboardEventHandler,
}: Props) => {
  const lines = renderLinesFromDoc(doc, mode, cursors, queuedCursors);
  return (
    <div className={styles.wrapper}>
      <div
        ref={codeDivRef}
        className={styles.doc}
        tabIndex={0}
        onKeyPress={(ev) => {
          onKeyPress(
            ev,
            wrapThrowRestore(docManager, () =>
              docManager.onKeyPress(ev.nativeEvent),
            ),
          );
        }}
        onKeyDown={(ev) => {
          onKeyDown(
            ev,
            wrapThrowRestore(docManager, () =>
              docManager.onKeyDown(ev.nativeEvent),
            ),
          );
        }}
        onKeyUp={(ev) => {
          onKeyUp(
            ev,
            wrapThrowRestore(docManager, () =>
              docManager.onKeyUp(ev.nativeEvent),
            ),
          );
        }}
      >
        {doc.text.trim() ? (
          <FollowLines lines={lines} />
        ) : (
          <div style={{ opacity: 0.5, userSelect: "none" }}>
            (empty document)
          </div>
        )}
      </div>
      <div className={styles.modeLine}>
        Mode: {Mode[mode]} ({MultiCursorMode[multiCursorMode]})
      </div>
      {cursorsOverlap === CursorOverlapKind.Nested && (
        <div className={styles.overlapWarning} style={{ color: "orange" }}>
          Warning: cursors are nested
        </div>
      )}
      {cursorsOverlap === CursorOverlapKind.NonNested && (
        <div className={styles.overlapWarning} style={{ color: "red" }}>
          Warning: cursors overlap in a non-nested way
        </div>
      )}
    </div>
  );
};
