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
import {
  applyTransformsToTree,
  Transform,
  MultiTransformCache,
  unapplyTransforms,
} from "../logic/transform";
import { compressUselessValuesTransform } from "../logic/transform/transforms/compress-useless-values";
import { flattenIfTransform } from "../logic/transform/transforms/flatten-if";

interface CombinedTrees {
  raw: Node<unknown>;
  transformed?: Node<unknown>;
}

const TYPESCRIPT_PROVIDER = new TypescriptProvider();
const INITIAL_FILE: string = "temp/fizz-buzz/index.ts";
const TRANSFORMS: Transform[] = [
  flattenIfTransform,
  compressUselessValuesTransform,
];

const transformCache: MultiTransformCache = new WeakMap();

export const HomeNew: React.FC<{}> = () => {
  const [_tree, _setTree] = useState<CombinedTrees>({
    raw: new EmptyLeafNode(),
  });
  const setRawTree = (raw: Node<unknown>) => _setTree({ raw });

  useEffect(() => {
    const openFile = (filePath: string) =>
      setRawTree(TYPESCRIPT_PROVIDER.loadTree(filePath));
    (window as any).openFile = openFile;
    openFile(INITIAL_FILE);
  }, []);

  const tree =
    _tree.transformed ||
    applyTransformsToTree(_tree.raw, TRANSFORMS, transformCache);
  const setTree = (updater: (oldTree: Node<unknown>) => Node<unknown>) => {
    _setTree(_tree => {
      const newTransformed = updater(
        _tree.transformed ||
          applyTransformsToTree(_tree.raw, TRANSFORMS, transformCache),
      );
      const output: CombinedTrees = {
        raw: _tree.raw,
        transformed: newTransformed,
      };
      const unapplyResult = unapplyTransforms(newTransformed);
      if (unapplyResult.ok) {
        output.raw = unapplyResult.value;
        output.transformed = undefined;
      }
      return output;
    });
  };

  const updateNode = (path: Path, value: Node<unknown>) => {
    setTree(tree => tree.setDeepChild(path, value));
  };

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
        ) as HTMLInputElement | null)?.focus(),
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
        disableNav={!!inProgressAction}
        onKeyDown={key =>
          handleKey(key, {
            tree,
            parentIndex,
            focusedId,
            setFocusedId,
            handleAction,
            cancelAction: () => setInProgressAction(undefined),
            actionInProgress: !!inProgressAction,
          })
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
