import * as React from "react";
import { ActionSet } from "../logic/tree/action";
import { Node } from "../logic/tree/node";
interface Props {
  actions: ActionSet<Node<unknown>>;
}
const SHORTCUTS_BY_ACTION_KEY: {
  [key: string]: string | undefined;
} = {
  setVariant: "Enter",
  setFromString: "Enter",
};
const PARENT_SHORTCUTS = ["replace", "deleteChild", "insertChildAtIndex"];
export const PossibleActionDisplay: React.FC<Props> = ({ actions }) => (
  <div>
    {Object.keys(actions).length ? (
      <>
        Possible actions:{" "}
        {Object.keys(actions)
          .sort()
          .filter((a) => !PARENT_SHORTCUTS.includes(a))
          .map((a) => {
            const shortcut = SHORTCUTS_BY_ACTION_KEY[a];
            return shortcut ? `${a} (${shortcut})` : a;
          })
          .join(", ")}
      </>
    ) : (
      "The selected node may not support any actions"
    )}
    <br />
    Other maybe possible actions: delete (x), add sibling below (ctrl-down), add
    sibling above (ctrl-up), copy (c), paste (p), printToConsole (0), save (9)
  </div>
);
