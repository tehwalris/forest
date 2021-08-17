import * as React from "react";
import { StringInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
interface Props<N extends Node<unknown>> {
  action: StringInputAction<N>;
  onApply: (node: N) => void;
}
export const StringFiller = <N extends Node<unknown>>({
  action,
  onApply,
}: Props<N>) => {
  return (
    <input
      type="text"
      placeholder="New value"
      onKeyDown={(ev) => {
        if (ev.ctrlKey || ev.metaKey) {
          ev.stopPropagation();
        }
      }}
      onKeyPress={(ev) =>
        ev.key === "Enter" && onApply(action.apply(ev.currentTarget.value))
      }
    />
  );
};
