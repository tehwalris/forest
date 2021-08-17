import * as React from "react";
import { nodeExamples } from "../../../logic/providers/typescript/node-examples";
import { OneOfInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
import Select, { ValueType } from "react-select";
import { useMemo, useState, useEffect } from "react";
import { css } from "@emotion/css";
interface Props<N extends Node<unknown>, T> {
  action: OneOfInputAction<N, T>;
  onApply: (node: N) => void;
}
interface Option<T> {
  value: number;
  original: T;
  label: string;
}
const styles = {
  option: css`
    display: flex;
    background: white;
    width: 350px;
    overflow: hidden;
    margin-bottom: 5px;
  `,
  optionRight: css`
    overflow: hidden;
  `,
  shortcut: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    background: wheat;
    width: 50px;
    overflow: hidden;
    margin-right: 5px;
  `,
  label: css`
    font-style: italic;
    color: grey;
  `,
  example: css`
    white-space: nowrap;
  `,
  noExample: css`
    font-style: italic;
    color: #ccc;
  `,
};
export const OneOfFiller = <N extends Node<unknown>, T>({
  action,
  onApply,
}: Props<N, T>) => {
  const { options, richOptions, optionsByShortcut } = useMemo(() => {
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
    const richOptions = action.oneOf.map((e, i) => {
      const label = action.getLabel(e);
      let shortcut = action.getShortcut(e);
      if (shortcut === "") {
        shortcut = "enter";
      }
      return {
        label,
        shortcut,
        example: nodeExamples.get(label),
      };
    });
    return {
      options,
      richOptions,
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
      <div>
        {richOptions.map(({ label, shortcut, example }) => (
          <div key={label} className={styles.option}>
            <div className={styles.shortcut}>{shortcut}</div>
            <div className={styles.optionRight}>
              {example ? (
                <div className={styles.example}>{example}</div>
              ) : (
                <div className={styles.noExample}>(no example)</div>
              )}
              <div className={styles.label}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
