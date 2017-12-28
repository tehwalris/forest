import * as React from "react";
import { Action, InputKind } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import StringFiller from "./string";
interface Props<N extends Node<{}>> {
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
export default <N extends Node<{}>>({
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
      throw new Error("not implemented");
    default:
      return null;
  }
};
