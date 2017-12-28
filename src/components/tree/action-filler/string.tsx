import * as React from "react";
import { StringInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
interface Props<N extends Node<{}>> {
  action: StringInputAction<N>;
  onApply: (node: N) => void;
}
export default <N extends Node<{}>>({ action, onApply }: Props<N>) => {
  return (
    <input
      type="text"
      placeholder="New value"
      onKeyPress={e =>
        e.key === "Enter" && onApply(action.apply(e.currentTarget.value))
      }
    />
  );
};
