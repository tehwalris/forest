import * as React from "react";
import { ActionSet } from "../logic/tree/action";
import { Node } from "../logic/tree/node";
interface Props {
  actions: ActionSet<Node<unknown>>;
}
const SHORTCUTS_BY_ACTION_KEY: {
  [key: string]: string | undefined;
} = {
  prepend: "ctrl-shift-i",
  append: "ctrl-shift-a",
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
    Other maybe possible actions: delete (ctrl-d), prepend sibling (ctrl-i),
    append sibling (ctrl-a), copy (ctrl-c), paste (ctrl-p), printToConsole
    (ctrl-0), save (ctrl-9)
  </div>
);
