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
  const editFlags = (nodes: { node: Node<{}>; path: Path }[]) => {
    interface Option {
      label: string;
      apply: (flags: FlagSet) => FlagSet;
      node: Node<{}>;
      path: Path;
    }
    const options = R.chain(
      R.pipe(
        ({ node, path }: { node: Node<{}>; path: Path }) =>
          R.mapObjIndexed((v: Flag, k) => ({ node, path, v, k }), node.flags),
        R.values,
        R.chain(({ k, v, node, path }): Option[] => {
          if (typeof v === "boolean") {
            return [
              {
                label: `${k} (${v ? "remove" : "add"})`,
                apply: R.assoc(k, !v),
                node,
                path,
              },
            ];
          }
          return v.oneOf
            .filter(e => e !== (v.value as string))
            .map((e: string) => ({
              label: `${e} (${k})`,
              apply: R.assoc(k, { ...v, value: e }),
              node,
              path,
            }));
        }),
      ),
      nodes,
    );
    if (options.length) {
      handleAction(
        {
          inputKind: InputKind.OneOf,
          oneOf: options,
          getLabel: e => e.label,
          getShortcut: () => undefined,
          apply: (e: Option): Node<{}> => {
            return e.node.setFlags(e.apply(e.node.flags));
          },
        },
        keyPath,
        undefined,
        undefined,
        undefined,
      );
    }
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
  };
  handlers[key]?.();
}
