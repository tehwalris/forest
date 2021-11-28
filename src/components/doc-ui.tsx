import { css } from "@emotion/css";
import * as React from "react";
import {
  CursorOverlapKind,
  DocManager,
  DocManagerPublicState,
  Mode,
  MultiCursorMode,
} from "../logic/doc-manager";
import {
  CharSelection,
  DocRenderLine,
  renderLinesFromDoc,
} from "../logic/render";
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
  statusArea: css`
    margin: 5px;
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
  state: {
    doc,
    mode,
    multiCursorMode,
    multiCursorFailure,
    cursors,
    cursorsOverlap,
    queuedCursors,
    chord,
  },
  codeDivRef,
  onKeyPress = defaultKeyboardEventHandler,
  onKeyDown = defaultKeyboardEventHandler,
  onKeyUp = defaultKeyboardEventHandler,
}: Props) => {
  let lines: DocRenderLine[];
  if (multiCursorFailure?.visualize) {
    lines = renderLinesFromDoc(
      multiCursorFailure.doc,
      Mode.Normal,
      [
        ...multiCursorFailure.successfulCursors,
        ...multiCursorFailure.failedCursors,
      ],
      [
        ...multiCursorFailure.successfulCursors.map((c) => ({
          range: c.focus,
          value: CharSelection.Success,
        })),
        ...multiCursorFailure.failedCursors.map((c) => ({
          range: c.focus,
          value: CharSelection.Failure,
        })),
      ],
    );
  } else {
    lines = renderLinesFromDoc(
      doc,
      mode,
      cursors,
      queuedCursors.map((c) => ({
        range: c.focus,
        value: CharSelection.Queued,
      })),
    );
  }
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
      <div className={styles.statusArea}>
        <div>
          <span>
            {Mode[mode]}-{MultiCursorMode[multiCursorMode]}
          </span>
          {" | "}
          <span>
            {cursors.length} cursor{cursors.length === 1 ? "" : "s"}
            {multiCursorFailure && (
              <span style={{ color: "orange" }}>
                {" "}
                ({multiCursorFailure.failedCursors.length}/
                {multiCursorFailure.successfulCursors.length +
                  multiCursorFailure.failedCursors.length}{" "}
                failed)
              </span>
            )}
          </span>
          {chord && (
            <>
              {" | "}
              <span>Chord: {chord.key}</span>
            </>
          )}
        </div>
        {cursorsOverlap === CursorOverlapKind.Nested && (
          <div style={{ color: "orange" }}>Warning: cursors are nested</div>
        )}
        {cursorsOverlap === CursorOverlapKind.NonNested && (
          <div style={{ color: "red" }}>
            Warning: cursors overlap in a non-nested way
          </div>
        )}
      </div>
    </div>
  );
};
