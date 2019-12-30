import * as React from "react";
import { EmptyLeafNode } from "../logic/tree/base-nodes";
import { Node, SemanticColor } from "../logic/tree/node";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  buildDivetreeDisplayTree,
  buildDivetreeNavTree,
  buildParentIndex,
} from "../logic/tree/display-new";
import { NavTree, RectStyle } from "divetree-react";
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
import * as R from "ramda";

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

type ColorPair = [number[], number[]];

const DEFAULT_COLORS: ColorPair = [
  [240, 240, 240],
  [170, 170, 170],
];
const COLORS: { [K in SemanticColor]: ColorPair } = {
  [SemanticColor.LITERAL]: [
    [91, 34, 39],
    [91, 34, 39],
  ],
  [SemanticColor.DECLARATION]: [
    [228, 172, 255],
    [166, 17, 238],
  ],
  [SemanticColor.REFERENCE]: [
    [44, 66, 84],
    [44, 66, 84],
  ],
};

function getNodeStyle(
  node: Node<unknown> | undefined,
  focused: boolean,
): RectStyle {
  const toStyle = (colors: ColorPair): RectStyle => ({
    color: colors[focused ? 1 : 0],
  });
  const semanticColor = node?.getDisplayInfo()?.color;
  if (!semanticColor) {
    return toStyle(DEFAULT_COLORS);
  }
  return toStyle(COLORS[semanticColor]);
}

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

  const [inProgressAction, setInProgressAction] = useState<{
    target: Path;
    action: Action<Node<unknown>>;
  }>();

  const handleAction: HandleAction = (
    action,
    target,
    focus,
    childActionArgument,
    nodeActionArgument,
  ) => {
    const updateTarget = (newNode: Node<unknown>) => {
      updateNode(target, newNode);
      const newFocusedId = focus?.(newNode);
      if (newFocusedId) {
        setFocusedId(newFocusedId);
      }
    };

    if (action.inputKind === InputKind.None) {
      updateTarget(action.apply());
    } else if (action.inputKind === InputKind.Child) {
      if (!childActionArgument) {
        throw new Error("Expected childActionArgument");
      }
      updateTarget(action.apply(childActionArgument));
    } else if (action.inputKind === InputKind.Node) {
      if (!nodeActionArgument) {
        throw new Error("Expected nodeActionArgument");
      }
      const newNode = action.apply(nodeActionArgument);
      updateTarget(newNode);
    } else {
      if (focus) {
        throw new Error(
          `the "focus" argument is not supported with actions which take user input`,
        );
      }
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

  const _lastFocusedIdPath = useRef([tree.id]);
  const [_focusedId, setFocusedId] = useState(tree.id);
  const _focusedIdPath = useMemo(
    () =>
      parentIndex.has(_focusedId)
        ? [
            ...parentIndex.get(_focusedId)!.path.map(e => e.parent.id),
            _focusedId,
          ]
        : _lastFocusedIdPath.current,
    [parentIndex, _focusedId, _lastFocusedIdPath],
  );
  const focusedId =
    R.findLast(id => parentIndex.has(id), _focusedIdPath) || _focusedId;
  useEffect(() => {
    _lastFocusedIdPath.current = _focusedIdPath;
  });

  const [copiedNode, setCopiedNode] = useState<Node<unknown>>();

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
        getStyle={(id, focused) =>
          getNodeStyle(parentIndex.get(id as string)?.node, focused)
        }
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
            copyNode: setCopiedNode,
            copiedNode,
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
