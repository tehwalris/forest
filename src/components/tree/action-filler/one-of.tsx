import * as React from "react";
import { OneOfInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import Select, { ValueType } from "react-select";
import { useMemo, useState, useEffect } from "react";
interface Props<N extends Node<unknown>, T> {
  action: OneOfInputAction<N, T>;
  onApply: (node: N) => void;
}
interface Option<T> {
  value: number;
  original: T;
  label: string;
}
export default <N extends Node<unknown>, T>({
  action,
  onApply,
}: Props<N, T>) => {
  const { options, optionsByShortcut } = useMemo(() => {
    const options = action.oneOf.map((e, i) => {
      let label = action.getLabel(e);
      const shortcut = action.getShortcut(e);
      if (shortcut) {
        label = `${label} (${shortcut})`;
      }
      return {
        value: i,
        original: e,
        label,
        shortcut,
      };
    });
    return {
      options,
      optionsByShortcut: new Map(options.map(o => [o.shortcut, o])),
    };
  }, [action]);

  const [pressedKeys, setPressedKeys] = useState("");
  const [searching, setSearching] = useState(!options.some(o => o.shortcut));
  useEffect(() => {
    if (searching) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Space") {
        setSearching(true);
      }
      if (e.key.length !== 1) {
        return;
      }
      setPressedKeys(k => k + e.key);
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.addEventListener("keydown", handler);
    };
  }, [searching]);
  useEffect(() => {
    const option = optionsByShortcut.get(pressedKeys);
    if (option) {
      onApply(action.apply(option.original));
    }
  }, [pressedKeys, action, onApply, optionsByShortcut]);

  if (!searching) {
    return (
      <div>
        Press shortcut keys to quickly select an option, or space to search
      </div>
    );
  }

  return (
    <Select
      onChange={(e: ValueType<Option<T>>) =>
        e && onApply(action.apply((e as Option<T>).original))
      }
      options={options}
    />
  );
};
