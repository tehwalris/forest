import * as React from "react";
import { OneOfInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import Select, { ValueType } from "react-select";
interface Props<N extends Node<{}>, T> {
  action: OneOfInputAction<N, T>;
  onApply: (node: N) => void;
}
interface Option<T> {
  value: number;
  original: T;
  label: string;
}
export default <N extends Node<{}>, T>({ action, onApply }: Props<N, T>) => {
  return (
    <Select
      onChange={(e: ValueType<Option<T>>) =>
        e && onApply(action.apply((e as Option<T>).original))
      }
      options={action.oneOf.map((e, i) => ({
        value: i,
        original: e,
        label: action.getLabel(e),
      }))}
    />
  );
};
