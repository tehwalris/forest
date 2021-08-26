import * as React from "react";
import { css } from "@emotion/css";
import { useState } from "react";
import { LiveStringInputAction } from "../../../logic/tree/action";
import { Node } from "../../../logic/tree/node";
interface Props<N extends Node<unknown>> {
  action: LiveStringInputAction<N>;
  onApply: (node: N) => void;
  onTriggerNextAction: () => void;
}
const styles = {
  message: css`
    margin-top: 5px;
  `,
};
export const LiveStringFiller = <N extends Node<unknown>>({
  action,
  onApply,
  onTriggerNextAction,
}: Props<N>) => {
  const [value, setValue] = useState("");
  const hasValue = !!value.trim();
  const result = action.preApply(value);

  return (
    <div>
      <input
        type="text"
        placeholder="New value"
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        onKeyDown={(ev) => {
          if (!(ev.key === "Escape" || (ev.key === " " && !value))) {
            ev.stopPropagation();
          }
        }}
        onKeyPress={(ev) => {
          if (ev.key === "Enter") {
            if (hasValue && result.ok) {
              onApply(action.apply(value));
            } else if (!hasValue) {
              onTriggerNextAction();
            }
          }
        }}
      />
      {
        <div
          className={styles.message}
          style={{
            color: !hasValue || result.ok ? "grey" : undefined,
          }}
        >
          {result.message}
        </div>
      }
    </div>
  );
};
