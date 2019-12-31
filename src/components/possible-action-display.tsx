import * as React from "react";
import { ActionSet } from "../logic/tree/action";
import { Node } from "../logic/tree/node";

interface Props {
  actions: ActionSet<Node<unknown>>;
}
const SHORTCUTS_BY_ACTION_KEY: {
  [key: string]: string | undefined;
} = {
  prepend: "r",
  append: "a",
  setFromString: "s",
  setVariant: "v",
  toggle: "t",
  insertByKey: "i",
  deleteByKey: "d",
};

export const PossibleActionDisplay: React.FC<Props> = ({ actions }) => (
  <div>
    {Object.keys(actions).length ? (
      <>
        Possible actions:{" "}
        {Object.keys(actions)
          .sort()
          .filter(a => !["replace", "deleteChild"].includes(a))
          .map(a => {
            const shortcut = SHORTCUTS_BY_ACTION_KEY[a];
            return shortcut ? `${a} (${shortcut})` : a;
          })
          .join(", ")}
      </>
    ) : (
      "The selected node may not support any actions"
    )}
    <br />
    Other maybe possible actions: delete (x), copy (c), paste (p),
    printToConsole (0), save (9)
  </div>
);
