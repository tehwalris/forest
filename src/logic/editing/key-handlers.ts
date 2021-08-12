import * as R from "ramda";
import { FileNode } from "../providers/typescript";
import { tryPrettyPrint } from "../providers/typescript/pretty-print";
import { ActionSet, InputKind } from "../tree/action";
import { Flag, Node } from "../tree/node";
import { HandleAction } from "./interfaces";
import { ParentIndex, idPathFromParentIndexEntry } from "../parent-index";
import type { PostLayoutHints } from "../layout-hints";
export interface Marks {
  [key: string]: string[];
}
interface HandleKeyOptions {
  parentIndex: ParentIndex;
  postLayoutHintsById: Map<string, PostLayoutHints>;
  focusedId: string;
  setFocusedId: (id: string) => void;
  setFocusedIdPath: (idPath: string[]) => void;
  handleAction: HandleAction;
  cancelAction: () => void;
  actionInProgress: boolean;
  copyNode: (node: Node<unknown>) => void;
  copiedNode: Node<unknown> | undefined;
  saveFile: (tree: FileNode) => void;
  marks: Marks;
  setMarks: (marks: Marks) => void;
  chord: string[];
  setChord: (chord: string[]) => void;
  setExpandView: (expandView: boolean) => void;
}
export function handleKey(
  event: KeyboardEvent,
  {
    parentIndex,
    postLayoutHintsById,
    focusedId,
    setFocusedId,
    setFocusedIdPath,
    handleAction,
    cancelAction,
    actionInProgress,
    copyNode,
    copiedNode,
    saveFile,
    marks,
    setMarks,
    chord,
    setChord,
    setExpandView,
  }: HandleKeyOptions,
) {
  if (actionInProgress && event.key !== "Escape") {
    return;
  }
  const parentIndexEntry = parentIndex.get(focusedId);
  if (!parentIndexEntry) {
    return;
  }
  const node = parentIndexEntry.node;
  const keyPath = parentIndexEntry.path.map((e) => e.childKey);
  const tryDeleteChild = () => {
    const parent = R.last(parentIndexEntry.path)?.parent;
    const action = parent?.actions.deleteChild;
    if (parent && action) {
      const targetKey = R.last(parentIndexEntry.path)!.childKey;
      handleAction(
        action,
        R.dropLast(1, parentIndexEntry.path).map((e) => e.childKey),
        undefined,
        { child: targetKey },
      );
      const targetIndex = parent.children.findIndex((e) => e.key === targetKey);
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
          .filter((e) => e !== (flag.value as string))
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
        getLabel: (e) => e.label,
        getShortcut: () => undefined,
        apply: (e: Option): Node<unknown> => {
          return node.setFlags({ ...node.flags, [e.key]: e.flag });
        },
      },
      keyPath,
      undefined,
      {},
    );
  };
  const insertSibling = (indexOffset: number) => {
    const lastApparentPathEntry = R.last(parentIndexEntry.path);
    if (!lastApparentPathEntry) {
      return;
    }
    const { parent, childKey } = lastApparentPathEntry;
    const childIndex =
      parent.children.findIndex((c) => c.key === childKey) + indexOffset;
    const action = parent?.actions.insertChildAtIndex;
    if (parent && action) {
      handleAction(
        action,
        R.dropLast(1, parentIndexEntry.path).map((e) => e.childKey),
        (n) => (n.children[childIndex]?.node || n).id,
        { childIndex },
      );
    }
  };
  const tryAction =
    (
      actionKey: keyof ActionSet<any>,
      focus?: (newNode: Node<unknown>) => string,
    ) =>
    () => {
      const action = node.actions[actionKey];
      if (action) {
        handleAction(action, keyPath, focus, { node: copiedNode });
      }
    };
  const findClosestFileNode = (): FileNode | undefined => {
    return [node, ...parentIndexEntry.path.map((e) => e.parent)].find(
      (maybeFileNode) => maybeFileNode && maybeFileNode instanceof FileNode,
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
  const focusApparentParent = () => {
    const parentEntry = R.last(parentIndexEntry.path);
    if (!parentEntry) {
      return;
    }
    setFocusedId(parentEntry.parent.id);
  };
  const handlers: {
    [key: string]: (() => void) | undefined;
  } = {
    d: () => {
      console.log("handlers", handlers);
      console.log("parentIndexEntry", parentIndexEntry);
      console.log("postLayoutHints", postLayoutHintsById.get(focusedId));
    },
    "9": save,
    "0": () => console.log(prettyPrint()),
    Escape: () => {
      if (actionInProgress) {
        cancelAction();
      } else {
        focusApparentParent();
      }
    },
    Backspace: focusApparentParent,
    Shift: () => setExpandView(true),
    "ctrl-ArrowRight": tryAction(
      "append",
      (n) => (R.last(n.children)?.node || n).id,
    ),
    "ctrl-ArrowUp": () => insertSibling(0),
    "ctrl-ArrowDown": () => insertSibling(1),
    Enter: node.actions.setVariant
      ? tryAction("setVariant", (n) => n.id)
      : tryAction("setFromString"),
    x: tryDeleteChild,
    c: () => copyNode(node),
    p: tryAction("replace", (n) => n.id),
    f: editFlags,
    4: () =>
      setMarks({
        ...marks,
        TODO: idPathFromParentIndexEntry(parentIndexEntry),
      }),
    5: () => {
      const path = marks.TODO;
      if (path) {
        setFocusedIdPath(path);
      }
    },
  };
  ["a", "b", "c"].forEach((k) => {
    handlers[`a ${k}`] = () =>
      setMarks({
        ...marks,
        [k]: idPathFromParentIndexEntry(parentIndexEntry),
      });
    handlers[`' ${k}`] = () => {
      if (marks[k]) {
        setFocusedIdPath(marks[k]);
      }
    };
  });
  Object.keys(handlers).forEach((oldCombo) => {
    if (oldCombo.match(/^[a-z0-9](?: |$)/)) {
      const newCombo = `space ${oldCombo}`;
      if (newCombo in handlers) {
        throw new Error(
          "adding space to oldCombo would overwrite an existing handler",
        );
      }
      handlers[newCombo] = handlers[oldCombo];
      delete handlers[oldCombo];
    }
  });
  for (const [shortcut, childPath] of node.getChildShortcuts()) {
    if (!shortcut.match(/^[a-z0-9]$/)) {
      throw new Error("shortcut has invalid format");
    }
    if (childPath.length !== 1) {
      throw new Error("only childPath.length === 1 is currently supported");
    }
    const child = node.getByPath(childPath);
    if (!child) {
      throw new Error("shortcut points to missing child");
    }
    handlers[shortcut] = () => {
      setFocusedIdPath([
        ...idPathFromParentIndexEntry(parentIndexEntry),
        child.id,
      ]);
    };
  }
  let keyCombo = event.key;
  if (keyCombo === " ") {
    keyCombo = "space";
  }
  if (event.ctrlKey) {
    keyCombo = "ctrl-" + keyCombo;
  }
  keyCombo = [...chord, keyCombo].join(" ");
  if (["'", "space"].includes(keyCombo)) {
    setChord([keyCombo]);
    return;
  }
  if (keyCombo === "space a") {
    setChord(["space", "a"]);
    return;
  }
  const wasChord = !!chord.length;
  if (wasChord) {
    setChord([]);
  }
  const handler = handlers[keyCombo];
  if (handler) {
    handler();
    event.preventDefault();
    event.stopPropagation();
  }
}
