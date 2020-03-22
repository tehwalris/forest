import * as R from "ramda";
import { FileNode } from "../providers/typescript";
import { tryPrettyPrint } from "../providers/typescript/pretty-print";
import { ActionSet, InputKind } from "../tree/action";
import { getNodeForDisplay } from "../tree/display-new";
import { Flag, Node } from "../tree/node";
import { HandleAction } from "./interfaces";
import { ParentIndex } from "../parent-index";
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
  metaLevelNodeIds: Set<string>;
  toggleNodeMetaLevel: (nodeId: string) => void;
}
export function handleKey(
  event: KeyboardEvent,
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
    metaLevelNodeIds,
    toggleNodeMetaLevel,
  }: HandleKeyOptions,
) {
  if (actionInProgress && event.key !== "Escape") {
    return;
  }
  const apparentParentIndexEntry = parentIndex.get(focusedId);
  if (!apparentParentIndexEntry) {
    return;
  }
  const { path: apparentPath } = apparentParentIndexEntry;
  const trueParentIndexEntry =
    parentIndex.get(
      getNodeForDisplay(apparentParentIndexEntry.node, metaLevelNodeIds).id,
    ) || apparentParentIndexEntry;
  const node = trueParentIndexEntry.node;
  const trueKeyPath = trueParentIndexEntry.path.map(e => e.childKey);
  const tryDeleteChild = () => {
    const parent = R.last(apparentPath)?.parent;
    const action = parent?.actions.deleteChild;
    if (parent && action) {
      const targetKey = R.last(apparentPath)!.childKey;
      handleAction(
        action,
        R.dropLast(1, apparentPath).map(e => e.childKey),
        undefined,
        { child: targetKey },
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
      trueKeyPath,
      undefined,
      {},
    );
  };
  const insertSibling = (indexOffset: number) => {
    const lastApparentPathEntry = R.last(apparentPath);
    if (!lastApparentPathEntry) {
      return;
    }
    const { parent, childKey } = lastApparentPathEntry;
    const childIndex =
      parent.children.findIndex(c => c.key === childKey) + indexOffset;
    const action = parent?.actions.insertChildAtIndex;
    if (parent && action) {
      handleAction(
        action,
        R.dropLast(1, apparentPath).map(e => e.childKey),
        n => (n.children[childIndex]?.node || n).id,
        { childIndex },
      );
    }
  };
  const tryAction = (
    actionKey: keyof ActionSet<any>,
    focus?: (newNode: Node<unknown>) => string,
  ) => () => {
    const action = node.actions[actionKey];
    if (action) {
      handleAction(action, trueKeyPath, focus, { node: copiedNode });
    }
  };
  const findClosestFileNode = (): FileNode | undefined => {
    return [node, ...apparentPath.map(e => e.parent)].find(
      maybeFileNode => maybeFileNode && maybeFileNode instanceof FileNode,
    ) as any;
  };
  const save = () => {
    const fileNode = findClosestFileNode();
    if (fileNode) {
      saveFile(fileNode);
    }
  };
  const prettyPrint = (): string | undefined => {
    const fileNode = findClosestFileNode();
    return fileNode && tryPrettyPrint(fileNode);
  };
  const handlers: {
    [key: string]: (() => void) | undefined;
  } = {
    Enter: () => console.log(apparentParentIndexEntry),
    "9": save,
    "0": () => console.log(prettyPrint()),
    Escape: cancelAction,
    R: tryAction("prepend", n => (n.children[0]?.node || n).id),
    "ctrl-ArrowRight": tryAction(
      "append",
      n => (R.last(n.children)?.node || n).id,
    ),
    "ctrl-ArrowUp": () => insertSibling(0),
    "ctrl-ArrowDown": () => insertSibling(1),
    s: tryAction("setFromString"),
    v: tryAction("setVariant"),
    t: tryAction("toggle"),
    i: tryAction("insertByKey"),
    d: tryAction("deleteByKey"),
    x: tryDeleteChild,
    c: () => copyNode(node),
    p: tryAction("replace", n => n.id),
    f: editFlags,
    m: () => toggleNodeMetaLevel(focusedId),
  };
  const comboAliasReplacements: [RegExp, string][] = [
    [/\bArrowUp\b/, "k"],
    [/\bArrowRight\b/, "l"],
    [/\bArrowDown\b/, "j"],
    [/\bArrowLeft\b/, "h"],
  ];
  Object.keys(handlers).forEach(combo => {
    for (const [target, replacement] of comboAliasReplacements) {
      const altCombo = combo.replace(target, replacement);
      if (altCombo !== combo && !handlers[altCombo]) {
        handlers[altCombo] = handlers[combo];
      }
    }
  });
  let keyCombo = event.key;
  if (event.ctrlKey) {
    keyCombo = "ctrl-" + keyCombo;
  }
  const handler = handlers[keyCombo];
  if (handler) {
    handler();
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}
