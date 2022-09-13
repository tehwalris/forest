import { css } from "@emotion/css";
import { useMantineTheme } from "@mantine/core";
import * as React from "react";
import {
  CursorOverlapKind,
  DocManager,
  DocManagerCommand,
  DocManagerPublicState,
  MinimalKeyboardEvent,
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
  docManager?: DocManager;
  state: DocManagerPublicState;
  codeDivRef?: React.RefObject<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler;
  onKeyUp?: KeyboardEventHandler;
  onCommand?: (
    ev: MinimalKeyboardEvent,
    command: DocManagerCommand | undefined,
  ) => void;
  alwaysStyleLikeFocused?: boolean;
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
  `,
  docDependentFocusStyles: css`
    &:focus {
      outline: 1px dotted black;
    }

    &:not(:focus) {
      filter: grayscale(1);
    }
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
  onKeyDown = defaultKeyboardEventHandler,
  onKeyUp = defaultKeyboardEventHandler,
  onCommand = () => {},
  alwaysStyleLikeFocused,
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
  const theme = useMantineTheme();
  return (
    <div className={styles.wrapper}>
      <div
        ref={codeDivRef}
        className={[
          styles.doc,
          !alwaysStyleLikeFocused && styles.docDependentFocusStyles,
        ]
          .filter((v) => v)
          .join(" ")}
        tabIndex={0}
        onKeyDown={(ev) => {
          onKeyDown(
            ev,
            docManager
              ? wrapThrowRestore(docManager, () =>
                  onCommand(
                    {
                      key: ev.key,
                      altKey: ev.altKey,
                      ctrlKey: ev.ctrlKey,
                      metaKey: ev.metaKey,
                      shiftKey: ev.shiftKey,
                    },
                    docManager.onKeyDown(ev.nativeEvent),
                  ),
                )
              : () => {},
          );
        }}
        onKeyUp={(ev) => {
          onKeyUp(
            ev,
            docManager
              ? wrapThrowRestore(docManager, () =>
                  docManager.onKeyUp(ev.nativeEvent),
                )
              : () => {},
          );
        }}
      >
        {doc.text.trim() ? (
          <FollowLines lines={lines} />
        ) : (
          <div
            style={{
              opacity: 0.5,
              userSelect: "none",
              padding: theme.spacing.md,
            }}
          >
            (empty document)
          </div>
        )}
      </div>
      <div style={{ margin: `${theme.spacing.xs}px ${theme.spacing.md}px ` }}>
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
