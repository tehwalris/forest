import { HandleAction } from "./interfaces";
import { Node } from "../tree/node";
import { ParentIndex } from "../tree/display-new";
import { ActionSet } from "../tree/action";
import * as R from "ramda";
import { FileNode } from "../providers/typescript";
import { format as prettierFormat } from "prettier";

const PRETTIER_OPTIONS = {
  parser: "typescript" as "typescript",
  printWidth: 80,
  plugins: undefined,
};

interface HandleKeyOptions {
  tree: Node<unknown>;
  parentIndex: ParentIndex;
  focusedId: string;
  setFocusedId: (id: string) => void;
  handleAction: HandleAction;
  cancelAction: () => void;
  actionInProgress: boolean;
  copyNode: (node: Node<unknown>) => void;
  copiedNode: Node<unknown> | undefined;
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
    actionInProgress,
    copyNode,
    copiedNode,
  }: HandleKeyOptions,
) {
  if (actionInProgress && key !== "Escape") {
    return;
  }

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

  const prettyPrint = () => {
    const fileNode: FileNode = tree.children[0].node as any;
    return fileNode.prettyPrint(t => {
      try {
        return prettierFormat(t, PRETTIER_OPTIONS);
      } catch (e) {
        console.warn("Failed to run prettier", e);
      }
      return t;
    });
  };

  const handlers: { [key: string]: (() => void) | undefined } = {
    Enter: () => console.log(parentIndexEntry),
    "0": () => console.log(prettyPrint()?.text),
    Escape: cancelAction,
    r: tryAction("prepend"),
    a: tryAction("append"),
    s: tryAction("setFromString"),
    v: tryAction("setVariant"),
    t: tryAction("toggle"),
    i: tryAction("insertByKey"),
    d: tryAction("deleteByKey"),
    x: tryDeleteChild,
    c: () => copyNode(node),
    p: () => console.log("DEBUG would paste", copiedNode),
  };
  handlers[key]?.();
}
