import { NavTree, RectStyle } from "divetree-react";
import * as _fsType from "fs";
import * as R from "ramda";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HandleAction } from "../logic/editing/interfaces";
import { handleKey } from "../logic/editing/key-handlers";
import TypescriptProvider, { FileNode } from "../logic/providers/typescript";
import {
  applyTransformsToTree,
  MultiTransformCache,
  Transform,
  unapplyTransforms,
} from "../logic/transform";
import { compressUselessValuesTransform } from "../logic/transform/transforms/compress-useless-values";
import { flattenIfTransform } from "../logic/transform/transforms/flatten-if";
import { simpleVariableDeclarationTransfrom } from "../logic/transform/transforms/simple-variable-declaration";
import {
  isMetaBranchNode,
  splitMetaTransform,
} from "../logic/transform/transforms/split-meta";
import { Action, InputKind } from "../logic/tree/action";
import { Path } from "../logic/tree/base";
import { EmptyLeafNode } from "../logic/tree/base-nodes";
import {
  buildDivetreeDisplayTree,
  buildDivetreeNavTree,
  buildParentIndex,
  getNodeForDisplay,
  ParentIndexEntry,
  idPathFromParentIndexEntry,
  getMetaBranchBranchIds,
} from "../logic/tree/display-new";
import { Node, SemanticColor } from "../logic/tree/node";
import { PossibleActionDisplay } from "./possible-action-display";
import { ActionFiller } from "./tree/action-filler";
import { NodeContent } from "./tree/node-content";

interface Props {
  fs: typeof _fsType;
}

interface CombinedTrees {
  raw: Node<unknown>;
  transformed?: Node<unknown>;
}

const TRANSFORMS: Transform[][] = [
  [simpleVariableDeclarationTransfrom],
  [flattenIfTransform, compressUselessValuesTransform],
  [splitMetaTransform],
];

const transformCache: MultiTransformCache = new WeakMap();

type ColorPair = [number[], number[]];

const DEFAULT_COLORS: ColorPair = [
  [240, 240, 240],
  [170, 170, 170],
];
const COLORS: { [K in SemanticColor]: ColorPair } = {
  [SemanticColor.LITERAL]: [
    [232, 178, 178],
    [232, 86, 99],
  ],
  [SemanticColor.DECLARATION]: [
    [228, 172, 255],
    [166, 17, 238],
  ],
  [SemanticColor.DECLARATION_NAME]: [
    [248, 254, 176],
    [254, 236, 31],
  ],
  [SemanticColor.REFERENCE]: [
    [197, 219, 238],
    [113, 169, 215],
  ],
};

function getNodeStyle(
  entry: ParentIndexEntry | undefined,
  focused: boolean,
): RectStyle {
  const toStyle = (colors: ColorPair): RectStyle => ({
    color: colors[focused ? 1 : 0],
  });
  const semanticColor = entry?.node.getDisplayInfo(entry.path)?.color;
  if (!semanticColor) {
    return toStyle(DEFAULT_COLORS);
  }
  return toStyle(COLORS[semanticColor]);
}

export const HomeNew: React.FC<Props> = ({ fs }) => {
  const [_trees, _setTrees] = useState<CombinedTrees>({
    raw: new EmptyLeafNode(),
  });

  const typescriptProvider = useRef(new TypescriptProvider(fs, "./"));

  const openFile = React.useCallback(async () => {
    _setTrees({
      raw: await typescriptProvider.current.loadTree(),
    });
  }, []);
  (window as any).openFile = openFile;
  useEffect(() => {
    openFile();
  }, [openFile]);

  const saveFile = async (tree: FileNode) => {
    typescriptProvider.current.trySaveFile(tree);
  };

  let tree = _trees.transformed || _trees.raw;
  // TODO Make this switchable from the editor
  if (!(window as any).noTransform) {
    tree = applyTransformsToTree(_trees.raw, TRANSFORMS, transformCache);
  }

  const setTree = (updater: (oldTree: Node<unknown>) => Node<unknown>) => {
    _setTrees(
      (_file): CombinedTrees => {
        const newTransformed = updater(
          _file.transformed ||
            applyTransformsToTree(_file.raw, TRANSFORMS, transformCache),
        );
        const output: CombinedTrees = {
          raw: _file.raw,
          transformed: newTransformed,
        };
        const unapplyResult = unapplyTransforms(newTransformed);
        if (unapplyResult.ok) {
          output.raw = unapplyResult.value;
          output.transformed = undefined;
        }
        return output;
      },
    );
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

  const [metaLevelNodeIds, _setMetaLevelNodeIds] = useState(new Set<string>());

  const { parentIndex, navTree, metaBranchBranchIds } = useMemo(() => {
    return {
      parentIndex: buildParentIndex(tree),
      navTree: buildDivetreeNavTree(tree, metaLevelNodeIds),
      metaBranchBranchIds: getMetaBranchBranchIds(tree),
    };
  }, [tree, metaLevelNodeIds]);

  const toggleNodeMetaLevel = (nodeId: string) => {
    const entry = parentIndex.get(nodeId);
    if (!entry) {
      return;
    }
    if (!isMetaBranchNode(entry.node)) {
      return;
    }
    const newIds: string[] = [];
    if (!metaLevelNodeIds.has(nodeId)) {
      newIds.push(nodeId);
    }
    entry.path.forEach(({ parent }) => {
      if (metaLevelNodeIds.has(parent.id) && isMetaBranchNode(parent)) {
        newIds.push(parent.id);
      }
    });
    _setMetaLevelNodeIds(new Set(newIds));
  };

  const _lastFocusedIdPath = useRef([tree.id]);
  const [_focusedId, setFocusedId] = useState(tree.id);
  const _focusedIdPath = useMemo(
    () =>
      parentIndex.has(_focusedId)
        ? idPathFromParentIndexEntry(parentIndex.get(_focusedId)!)
        : _lastFocusedIdPath.current,
    [parentIndex, _focusedId, _lastFocusedIdPath],
  );
  useEffect(() => {
    const focusedIds = new Set(_focusedIdPath);
    const validMetaLevelNodeIds = [...metaLevelNodeIds].filter(id =>
      focusedIds.has(id),
    );
    if (validMetaLevelNodeIds.length !== metaLevelNodeIds.size) {
      _setMetaLevelNodeIds(new Set(validMetaLevelNodeIds));
    }
  }, [_focusedIdPath, metaLevelNodeIds]);
  const focusedId =
    R.findLast(id => parentIndex.has(id), _focusedIdPath) || _focusedId;
  useEffect(() => {
    _lastFocusedIdPath.current = _focusedIdPath;
  });

  const apparentFocusedNode = parentIndex.get(focusedId)?.node;
  const trueFocusedNode =
    apparentFocusedNode &&
    getNodeForDisplay(apparentFocusedNode, metaLevelNodeIds);

  const [copiedNode, setCopiedNode] = useState<Node<unknown>>();

  return (
    <div>
      <NavTree
        navTree={navTree}
        getDisplayTree={focusPath =>
          buildDivetreeDisplayTree(tree, focusPath, 0, metaLevelNodeIds)
        }
        getContent={id => (
          <NodeContent parentIndexEntry={parentIndex.get(id as string)} />
        )}
        getStyle={(id, focused) =>
          getNodeStyle(parentIndex.get(id as string), focused)
        }
        focusedIdPath={
          parentIndex.has(focusedId)
            ? idPathFromParentIndexEntry(parentIndex.get(focusedId)!).filter(
                id => !metaBranchBranchIds.has(id),
              )
            : []
        }
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
            saveFile,
            metaLevelNodeIds,
            toggleNodeMetaLevel,
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
      {!inProgressAction && (
        <PossibleActionDisplay actions={trueFocusedNode?.actions || {}} />
      )}
    </div>
  );
};
