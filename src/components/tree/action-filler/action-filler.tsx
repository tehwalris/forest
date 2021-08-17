import * as React from "react";
import { Action, InputKind } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import { StringFiller } from "./string";
import { OneOfFiller } from "./one-of";
import { css } from "@emotion/css";
interface Props<N extends Node<unknown>> {
  action: Action<N>;
  onCancel: () => void;
  onApply: (node: N) => void;
}
const styles = {
  wrapper: css`
    --margin: 10px;
    --margin-top: 300px;

    position: relative;
    margin: var(--margin);
    margin-top: var(--margin-top);
    min-height: calc(100% - var(--margin-top) - var(--margin));
    box-sizing: border-box;
    padding: 10px;
    background: rgba(217, 217, 217, 0.8);
    backdrop-filter: blur(5px);
    border-radius: 4px;
  `,
  toolbar: css`
    position: absolute;
    top: 0;
    right: 0;
    margin: 5px;
  `,
};
export const ActionFiller = <N extends Node<unknown>>({
  action,
  onApply,
  onCancel,
}: Props<N>) => {
  const wrap = (e: React.ReactElement<{}>) => (
    <div className={`actionFiller ${styles.wrapper}`}>
      <div className={styles.toolbar}>
        <button onClick={onCancel}>Cancel</button>
      </div>
      {e}
    </div>
  );
  switch (action.inputKind) {
    case InputKind.String:
      return wrap(<StringFiller action={action} onApply={onApply} />);
    case InputKind.OneOf:
      return wrap(<OneOfFiller action={action} onApply={onApply} />);
    default:
      return null;
  }
};
