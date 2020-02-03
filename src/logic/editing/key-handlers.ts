import { HandleAction } from "./interfaces";
import { Node, FlagSet, Flag } from "../tree/node";
import { ParentIndex } from "../tree/display-new";
import { ActionSet, InputKind } from "../tree/action";
import * as R from "ramda";
import { FileNode } from "../providers/typescript";
import { tryPrettyPrint } from "../providers/typescript/pretty-print";
import { Path } from "../tree/base";
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
  saveFile: (tree: FileNode) => void;
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
    saveFile,
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
        undefined,
        targetKey,
        undefined,
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
  const editFlags = () => {
    interface Option {
      key: string;
      flag: Flag;
      label: string;
    }
    const options: Option[] = R.pipe(
      R.mapObjIndexed((flag: Flag, key) => ({ flag, key })),
      R.values,
      R.chain(({ key, flag }): Option[] => {
        if (typeof flag === "boolean") {
          return [
            { label: `${key} (${flag ? "remove" : "add"})`, key, flag: !flag },
          ];
        }
        return flag.oneOf
          .filter(e => e !== (flag.value as string))
          .map((e: string) => ({
            label: `${e} (${key})`,
            key,
            flag: { ...flag, value: e },
          }));
      }),
    )(node.flags);
    handleAction(
      {
        inputKind: InputKind.OneOf,
        oneOf: options,
        getLabel: e => e.label,
        getShortcut: () => undefined,
        apply: (e: Option): Node<unknown> => {
          return node.setFlags({ ...node.flags, [e.key]: e.flag });
        },
      },
      keyPath,
      undefined,
      undefined,
      undefined,
    );
  };
  const tryAction = (
    actionKey: keyof ActionSet<any>,
    focus?: (newNode: Node<unknown>) => string,
  ) => () => {
    const action = node.actions[actionKey];
    if (action) {
      handleAction(action, keyPath, focus, undefined, copiedNode);
    }
  };
  const save = () => {
    const fileNode: FileNode | undefined = tree.children[0].node as any;
    if (fileNode) {
      saveFile(fileNode);
    }
  };
  const prettyPrint = (): string | undefined => {
    const fileNode: FileNode | undefined = tree.children[0].node as any;
    return fileNode && tryPrettyPrint(fileNode);
  };
  const handlers: {
    [key: string]: (() => void) | undefined;
  } = {
    Enter: () => console.log(parentIndexEntry),
    "9": save,
    "0": () => console.log(prettyPrint()),
    Escape: cancelAction,
    r: tryAction("prepend", n => (n.children[0]?.node || n).id),
    a: tryAction("append", n => (R.last(n.children)?.node || n).id),
    s: tryAction("setFromString"),
    v: tryAction("setVariant"),
    t: tryAction("toggle"),
    i: tryAction("insertByKey"),
    d: tryAction("deleteByKey"),
    x: tryDeleteChild,
    c: () => copyNode(node),
    p: tryAction("replace", n => n.id),
    f: editFlags,
  };
  handlers[key]?.();
}
