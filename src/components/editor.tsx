import { NavTree, RectStyle } from "divetree-react";
import * as _fsType from "fs";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HandleAction } from "../logic/editing/interfaces";
import { handleKey, Marks } from "../logic/editing/key-handlers";
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
import { isMetaBranchNode } from "../logic/transform/transforms/split-meta";
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
import { PreLayoutHints, PostLayoutHints } from "../logic/layout-hints";
interface Props {
  fs: typeof _fsType;
  projectRootDir: string;
}
interface CombinedTrees {
  raw: Node<unknown>;
  transformed?: Node<unknown>;
}
const TRANSFORMS: Transform[][] = [
  [simpleVariableDeclarationTransform],
  // [chainTransform], // TODO crashes sometimes after TS
  [flattenIfTransform, compressUselessValuesTransform],
  // [splitMetaTransform], // Annoying with child shortcuts
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
const treeFromCombined = (combined: CombinedTrees) => {
  let tree = combined.transformed || combined.raw;
  if (tree === combined.raw && !(window as any).noTransform) {
    tree = applyTransformsToTree(combined.raw, TRANSFORMS, transformCache);
  }
  return tree;
};
export const Editor: React.FC<Props> = ({ fs, projectRootDir }) => {
  const [_trees, _setTrees] = useState<CombinedTrees>({
    raw: new EmptyLeafNode("Loading..."),
  });
  const typescriptProvider = useRef(new TypescriptProvider(fs, projectRootDir));
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
  const tree = treeFromCombined(_trees);
  const setTree = (
    updater: (oldTree: Node<unknown>) => Node<unknown>,
    onNewKnown: (newTree: Node<unknown>) => void,
  ) => {
    _setTrees((_trees): CombinedTrees => {
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
      onNewKnown(treeFromCombined(output));
      return output;
    });
  };
  const updateNode = (
    path: Path,
    value: Node<unknown>,
    focus?: (newNode: Node<unknown>) => string,
  ) => {
    setTree(
      (oldTree) => oldTree.setDeepChild(path, value),
      (newTree) => {
        const newNode = newTree.getDeepestPossibleByPath(path);
        if (newNode.path.length === path.length && focus) {
          setFocusedId(focus(newNode.node));
        }
      },
    );
  };
  const [inProgressAction, setInProgressAction] = useState<{
    target: Path;
    action: Action<Node<unknown>>;
    focus?: (newNode: Node<unknown>) => string;
  }>();
  const handleAction: HandleAction = (action, target, focus, args) => {
    const updateTarget = (newNode: Node<unknown>) => {
      updateNode(target, newNode, focus);
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
      setInProgressAction({ target, action, focus });
      setImmediate(() =>
        (
          document.querySelector(
            ".actionFiller input",
          ) as HTMLInputElement | null
        )?.focus(),
      );
    }
  };
  const onActionApply = (updatedNode: Node<unknown>) => {
    if (!inProgressAction) {
      throw new Error("Expected an action to be in-progress.");
    }
    updateNode(inProgressAction.target, updatedNode, inProgressAction.focus);
    setInProgressAction(undefined);
  };
  const [metaLevelNodeIds, setMetaLevelNodeIds] = useState(new Set<string>());
  const incrementalParentIndex = useMemo(
    () => new IncrementalParentIndex(tree),
    [tree],
  );
  const [focusedParentIndexEntry, setFocusedId, setFocusedIdPath] = useFocus(
    tree,
    incrementalParentIndex,
  );
  const navTree = useMemo(
    () => buildDivetreeNavTree(tree, metaLevelNodeIds),
    [tree, metaLevelNodeIds],
  );
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
    const firstChildId = entry.node.children.find((c) => c.key === "meta")?.node
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
  const [marks, setMarks] = useState<Marks>({});
  const [chord, setChord] = useState<string[]>([]);
  const preLayoutHintsByIdRef = useRef(new Map<string, PreLayoutHints>());
  const postLayoutHintsByIdRef = useRef(new Map<string, PostLayoutHints>());
  return (
    <div>
      <NavTree
        navTree={navTree}
        getDisplayTree={(focusPath) => {
          preLayoutHintsByIdRef.current = new Map();
          postLayoutHintsByIdRef.current = new Map();
          return buildDivetreeDisplayTree(
            tree,
            focusPath,
            0,
            metaLevelNodeIds,
            incrementalParentIndex,
            preLayoutHintsByIdRef.current,
            postLayoutHintsByIdRef.current,
          );
        }}
        getContent={(id) => (
          <NodeContent
            parentIndexEntry={incrementalParentIndex.get(id as string)}
            postLayoutHints={postLayoutHintsByIdRef.current.get(id as string)}
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
        onKeyDown={(ev) =>
          handleKey(ev, {
            tree,
            parentIndex: incrementalParentIndex,
            focusedId: focusedParentIndexEntry.node.id,
            setFocusedId,
            setFocusedIdPath,
            handleAction,
            cancelAction: () => setInProgressAction(undefined),
            actionInProgress: !!inProgressAction,
            copyNode: setCopiedNode,
            copiedNode,
            saveFile,
            metaLevelNodeIds,
            toggleNodeMetaLevel,
            marks,
            setMarks,
            chord,
            setChord,
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
