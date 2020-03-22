import { NavTree, RectStyle } from "divetree-react";
import * as _fsType from "fs";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HandleAction } from "../logic/editing/interfaces";
import { handleKey } from "../logic/editing/key-handlers";
import {
  IncrementalParentIndex,
  ParentIndexEntry,
  idPathFromParentIndexEntry,
} from "../logic/parent-index";
import TypescriptProvider, { FileNode } from "../logic/providers/typescript";
import {
  applyTransformsToTree,
  MultiTransformCache,
  Transform,
  unapplyTransforms,
} from "../logic/transform";
import { compressUselessValuesTransform } from "../logic/transform/transforms/compress-useless-values";
import { flattenIfTransform } from "../logic/transform/transforms/flatten-if";
import { simpleVariableDeclarationTransform } from "../logic/transform/transforms/simple-variable-declaration";
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
  getNodeForDisplay,
} from "../logic/tree/display-new";
import { Node, SemanticColor } from "../logic/tree/node";
import { useFocus } from "../logic/use-focus";
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
  [simpleVariableDeclarationTransform],
  [flattenIfTransform, compressUselessValuesTransform],
  [splitMetaTransform],
];
const transformCache: MultiTransformCache = {
  apply: new WeakMap(),
  unapply: new WeakMap(),
};
type ColorPair = [number[], number[]];
const DEFAULT_COLORS: ColorPair = [
  [240, 240, 240],
  [170, 170, 170],
];
const COLORS: {
  [K in SemanticColor]: ColorPair;
} = {
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
    _setTrees({ raw: await typescriptProvider.current.loadTree() });
  }, []);
  (window as any).openFile = openFile;
  useEffect(() => {
    openFile();
  }, [openFile]);
  const saveFile = async (tree: FileNode) => {
    typescriptProvider.current.trySaveFile(tree);
  };
  let tree = _trees.transformed || _trees.raw;
  if (tree === _trees.raw && !(window as any).noTransform) {
    tree = applyTransformsToTree(_trees.raw, TRANSFORMS, transformCache);
  }
  const setTree = (updater: (oldTree: Node<unknown>) => Node<unknown>) => {
    _setTrees(
      (_trees): CombinedTrees => {
        const newTransformed = updater(
          _trees.transformed ||
            applyTransformsToTree(_trees.raw, TRANSFORMS, transformCache),
        );
        const output: CombinedTrees = {
          raw: _trees.raw,
          transformed: newTransformed,
        };
        const unapplyResult = unapplyTransforms(
          newTransformed,
          transformCache.unapply,
        );
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
  const handleAction: HandleAction = (action, target, focus, args) => {
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
      if (!args.child) {
        throw new Error("Expected args.child");
      }
      updateTarget(action.apply(args.child));
    } else if (action.inputKind === InputKind.ChildIndex) {
      if (args.childIndex === undefined) {
        throw new Error("Expected args.childIndex");
      }
      updateTarget(action.apply(args.childIndex));
    } else if (action.inputKind === InputKind.Node) {
      if (!args.node) {
        throw new Error("Expected args.node");
      }
      const newNode = action.apply(args.node);
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
  const [metaLevelNodeIds, setMetaLevelNodeIds] = useState(new Set<string>());
  const incrementalParentIndex = useMemo(
    () => new IncrementalParentIndex(tree),
    [tree],
  );
  const [focusedParentIndexEntry, setFocusedId] = useFocus(
    tree,
    incrementalParentIndex,
  );
  const navTree = useMemo(() => buildDivetreeNavTree(tree, metaLevelNodeIds), [
    tree,
    metaLevelNodeIds,
  ]);
  useEffect(() => {
    const newIds = new Set<string>();
    focusedParentIndexEntry.path.forEach(({ parent }) => {
      if (metaLevelNodeIds.has(parent.id) && isMetaBranchNode(parent)) {
        newIds.add(parent.id);
      }
    });
    if (newIds.size !== metaLevelNodeIds.size) {
      setMetaLevelNodeIds(newIds);
    }
  }, [focusedParentIndexEntry, metaLevelNodeIds]);
  const toggleNodeMetaLevel = (nodeId: string) => {
    const entry = incrementalParentIndex.get(nodeId);
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
    const firstChildId = entry.node.children.find(c => c.key === "meta")?.node
      .children[0]?.node.id;
    if (firstChildId) {
      setFocusedId(firstChildId);
      setMetaLevelNodeIds(new Set(newIds));
    }
  };
  const trueFocusedNode = getNodeForDisplay(
    focusedParentIndexEntry.node,
    metaLevelNodeIds,
  );
  incrementalParentIndex.addObservation(trueFocusedNode);
  const [copiedNode, setCopiedNode] = useState<Node<unknown>>();
  return (
    <div>
      <NavTree
        navTree={navTree}
        getDisplayTree={focusPath =>
          buildDivetreeDisplayTree(
            tree,
            focusPath,
            0,
            metaLevelNodeIds,
            incrementalParentIndex,
          )
        }
        getContent={id => (
          <NodeContent
            parentIndexEntry={incrementalParentIndex.get(id as string)}
          />
        )}
        getStyle={(id, focused) =>
          getNodeStyle(incrementalParentIndex.get(id as string), focused)
        }
        focusedIdPath={idPathFromParentIndexEntry(
          focusedParentIndexEntry,
          (node, parent) => !parent || !isMetaBranchNode(parent),
        )}
        onFocusedIdChange={setFocusedId}
        disableNav={!!inProgressAction}
        onKeyDown={ev =>
          handleKey(ev, {
            tree,
            parentIndex: incrementalParentIndex,
            focusedId: focusedParentIndexEntry.node.id,
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
