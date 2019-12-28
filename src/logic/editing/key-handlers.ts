import { HandleAction } from "./interfaces";
import { Node } from "../tree/node";
import { ParentIndex } from "../tree/display-new";
import { ActionSet } from "../tree/action";
import * as R from "ramda";

interface HandleKeyOptions {
  tree: Node<unknown>;
  parentIndex: ParentIndex;
  focusedId: string;
  setFocusedId: (id: string) => void;
  handleAction: HandleAction;
  cancelAction: () => void;
}

export function handleKey(
  key: string,
  {
    tree,
    parentIndex,
    focusedId,
    setFocusedId,
    handleAction,
    cancelAction,
  }: HandleKeyOptions,
) {
  const parentIndexEntry = parentIndex.get(focusedId);
  if (!parentIndexEntry) {
    return;
  }
  const { node, path } = parentIndexEntry;
  const keyPath = path.map(e => e.childKey);

  const tryDeleteChild = () => {
    const parent = R.last(path)?.parent;
    const action = parent?.actions.deleteChild;
    if (parent && action) {
      const targetKey = R.last(path)!.childKey;
      handleAction(
        action,
        R.dropLast(1, path).map(e => e.childKey),
        targetKey,
      );

      const targetIndex = parent.children.findIndex(e => e.key === targetKey);
      setFocusedId(
        (
          parent.children[targetIndex + 1]?.node ||
          parent.children[targetIndex - 1]?.node ||
          parent
        ).id,
      );
    }
  };

  const tryAction = (actionKey: keyof ActionSet<any>) => () => {
    const action = node.actions[actionKey];
    if (action) {
      handleAction(action, keyPath, undefined);
    }
  };

  const handlers: { [key: string]: (() => void) | undefined } = {
    Escape: cancelAction,
    p: tryAction("prepend"),
    a: tryAction("append"),
    s: tryAction("setFromString"),
    v: tryAction("setVariant"),
    t: tryAction("toggle"),
    i: tryAction("insertByKey"),
    d: tryAction("deleteByKey"),
    x: tryDeleteChild,
  };
  handlers[key]?.();
}
