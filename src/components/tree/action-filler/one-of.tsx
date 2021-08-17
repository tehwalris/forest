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
export const OneOfFiller = <N extends Node<unknown>, T>({
  action,
  onApply,
}: Props<N, T>) => {
  const { options, optionsByShortcut } = useMemo(() => {
    const options = action.oneOf.map((e, i) => {
      let label = action.getLabel(e);
      const shortcut = action.getShortcut(e);
      if (shortcut !== undefined) {
        label = `${label} (${shortcut || "enter"})`;
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
      optionsByShortcut: new Map(options.map((o) => [o.shortcut, o])),
    };
  }, [action]);

  const [pressedKeys, setPressedKeys] = useState("");
  const [searching, setSearching] = useState(
    options.every((o) => o.shortcut === undefined),
  );
  useEffect(() => {
    if (searching) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setSearching(true);
        (
          document.querySelector(
            ".actionFiller input",
          ) as HTMLInputElement | null
        )?.focus();
        return;
      }
      if (e.key === "Enter") {
        const option = optionsByShortcut.get(pressedKeys);
        if (option) {
          onApply(action.apply(option.original));
        }
        return;
      }
      if (e.key.length !== 1 || e.key === " ") {
        return;
      }
      e.stopPropagation();
      setPressedKeys((k) => k + e.key);
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  });
  useEffect(() => {
    const option = optionsByShortcut.get(pressedKeys);
    if (
      pressedKeys &&
      option &&
      ![...optionsByShortcut.keys()].some(
        (k) => k?.startsWith(pressedKeys) && k !== pressedKeys,
      )
    ) {
      onApply(action.apply(option.original));
    }
  }, [pressedKeys, action, onApply, optionsByShortcut]);

  return (
    <div>
      {searching ? (
        <Select
          onChange={(e: ValueType<Option<T>, false>) =>
            e && onApply(action.apply((e as Option<T>).original))
          }
          options={options}
        />
      ) : (
        <div>
          Press shortcut keys to quickly select an option, or down arrow to
          search
        </div>
      )}
      <ul>
        {options.map(({ value, label }) => (
          <li key={value}>{label}</li>
        ))}
      </ul>
    </div>
  );
};
