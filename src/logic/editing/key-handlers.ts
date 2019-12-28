import { HandleAction } from "./interfaces";
import { Node } from "../tree/node";
import { ParentIndex } from "../tree/display-new";
import { ActionSet } from "../tree/action";

interface HandleKeyOptions {
  tree: Node<unknown>;
  parentIndex: ParentIndex;
  focusedId: string;
  handleAction: HandleAction;
}

export function handleKey(
  key: string,
  { tree, parentIndex, focusedId, handleAction }: HandleKeyOptions,
) {
  const parentIndexEntry = parentIndex.get(focusedId);
  if (!parentIndexEntry) {
    return;
  }
  const { node, path } = parentIndexEntry;
  const keyPath = path.map(e => e.childKey);

  const tryAction = (actionKey: keyof ActionSet<any>) => () => {
    const action = node.actions[actionKey];
    if (action) {
      handleAction(action, keyPath, undefined);
    }
  };

  const handlers: { [key: string]: (() => void) | undefined } = {
    p: tryAction("prepend"),
    a: tryAction("append"),
    s: tryAction("setFromString"),
    v: tryAction("setVariant"),
    t: tryAction("toggle"),
    i: tryAction("insertByKey"),
    d: tryAction("deleteByKey"),
  };
  handlers[key]?.();
}
