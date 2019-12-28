import * as React from "react";
import { EmptyLeafNode } from "../logic/tree/base-nodes";
import { Node } from "../logic/tree/node";
import { useMemo, useState, useEffect } from "react";
import {
  buildDivetreeDisplayTree,
  buildDivetreeNavTree,
  buildParentIndex,
} from "../logic/tree/display-new";
import { NavTree } from "divetree-react";
import TypescriptProvider from "../logic/providers/typescript";
import { NodeContent } from "./tree/node-content";
import { Path } from "../logic/tree/base";
import { InputKind, Action } from "../logic/tree/action";
import { HandleAction } from "../logic/editing/interfaces";
import { handleKey } from "../logic/editing/key-handlers";
import { ActionFiller } from "./tree/action-filler";

const TYPESCRIPT_PROVIDER = new TypescriptProvider();
const INITIAL_FILE: string = "temp/fizz-buzz/index.ts";

export const HomeNew: React.FC<{}> = () => {
  const [tree, setTree] = useState<Node<unknown>>(new EmptyLeafNode());
  const updateNode = (path: Path, value: Node<unknown>) => {
    setTree(tree => tree.setDeepChild(path, value));
  };

  useEffect(() => {
    const openFile = (filePath: string) =>
      setTree(TYPESCRIPT_PROVIDER.loadTree(filePath));
    (window as any).openFile = openFile;
    openFile(INITIAL_FILE);
  }, []);

  const [focusedId, setFocusedId] = useState(tree.id);
  const [inProgressAction, setInProgressAction] = useState<{
    target: Path;
    action: Action<Node<unknown>>;
  }>();

  const handleAction: HandleAction = (action, target, childActionArgument) => {
    if (action.inputKind === InputKind.None) {
      updateNode(target, action.apply());
    } else if (action.inputKind === InputKind.Child) {
      if (!childActionArgument) {
        throw new Error("Expected childActionArgument");
      }
      updateNode(target, action.apply(childActionArgument));
    } else {
      setInProgressAction({ target, action });
      setImmediate(() =>
        (document.querySelector(
          ".actionFiller input",
        ) as HTMLInputElement).focus(),
      );
    }
  };
  const onActionApply = (updatedNode: Node<unknown>) => {
    if (!inProgressAction) {
      throw new Error("Expected an action to be in-progress.");
    }
    updateNode(inProgressAction.target, updatedNode);
    setInProgressAction(undefined);
  };

  const { parentIndex, navTree } = useMemo(() => {
    return {
      parentIndex: buildParentIndex(tree),
      navTree: buildDivetreeNavTree(tree),
    };
  }, [tree]);

  return (
    <div>
      <NavTree
        navTree={navTree}
        getDisplayTree={focusPath =>
          buildDivetreeDisplayTree(tree, focusPath, 0)
        }
        getContent={id => (
          <NodeContent parentIndexEntry={parentIndex.get(id as string)} />
        )}
        focusedId={focusedId}
        onFocusedIdChange={setFocusedId}
        disableKeys={!!inProgressAction}
        onKeyDown={key =>
          handleKey(key, { tree, parentIndex, focusedId, handleAction })
        }
      />
      {inProgressAction && (
        <ActionFiller
          action={inProgressAction.action}
          onCancel={() => setInProgressAction(undefined)}
          onApply={onActionApply}
        />
      )}
    </div>
  );
};
