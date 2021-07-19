import * as React from "react";
import { Action, InputKind } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import { StringFiller } from "./string";
import { OneOfFiller } from "./one-of";
interface Props<N extends Node<unknown>> {
  action: Action<N>;
  onCancel: () => void;
  onApply: (node: N) => void;
}
const styles = {
  wrapper: {
    border: "1px solid black",
    padding: "5px",
  },
};
export const ActionFiller = <N extends Node<unknown>>({
  action,
  onApply,
  onCancel,
}: Props<N>) => {
  const wrap = (e: React.ReactElement<{}>) => (
    <div className="actionFiller" style={styles.wrapper}>
      {e}
      <button onClick={onCancel}>Cancel</button>
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
