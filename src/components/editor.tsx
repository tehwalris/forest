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
import { Action, InputKind } from "../logic/tree/action";
import { Path } from "../logic/tree/base";
import { EmptyLeafNode } from "../logic/tree/base-nodes";
import {
  buildDivetreeDisplayTree,
  buildDivetreeNavTree,
  DisplayTreeCacheEntry,
} from "../logic/tree/display-new";
import { Node, SemanticColor } from "../logic/tree/node";
import { useFocus } from "../logic/use-focus";
import { PossibleActionDisplay } from "./possible-action-display";
import { ActionFiller } from "./tree/action-filler";
import {
  NodeContent,
  makeTextMeasurementFunctionsByStyle,
} from "./tree/node-content";
import { PostLayoutHints } from "../logic/layout-hints";
import { LabelMeasurementCache } from "../logic/text-measurement";
import { useDelayedInput, DelayedInputKind } from "../logic/delayed-input";
import { unreachable } from "../logic/util";
import { RequiredHoleNode } from "../logic/providers/typescript/template-nodes";
import { useCallback } from "react";
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
  postLayoutHints: PostLayoutHints | undefined,
  focused: boolean,
): RectStyle {
  const toStyle = (colors: ColorPair): RectStyle => {
    const result: RectStyle = {
      color: colors[focused ? 1 : 0],
      borderColor: [0, 0, 0],
    };
    if (
      (postLayoutHints?.styleAsText && !focused) ||
      postLayoutHints?.shortcutKey ||
      postLayoutHints?.hideFocus
    ) {
      result.color = [0, 0, 0, 0];
      result.borderColor = [0, 0, 0, 0];
    }
    if (postLayoutHints?.shortcutKey) {
      result.extra = { overflow: "visible", contain: "layout size", zIndex: 2 };
    }
    return result;
  };
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
  const [inProgressAction, setInProgressAction] = useState<{
    target: Path;
    action: Action<Node<unknown>>;
    focus?: (newNode: Node<unknown>) => string;
  }>();
  const onActionApply = (updatedNode: Node<unknown>) => {
    if (!inProgressAction) {
      throw new Error("Expected an action to be in-progress.");
    }
    updateNode(inProgressAction.target, updatedNode, inProgressAction.focus);
    setInProgressAction(undefined);
  };
  const incrementalParentIndex = useMemo(
    () => new IncrementalParentIndex(tree),
    [tree],
  );
  const [focusedParentIndexEntry, setFocusedId, setFocusedIdPath] = useFocus(
    tree,
    incrementalParentIndex,
  );
  const updateNode = useCallback(
    (
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
    },
    [setFocusedId],
  );
  const handleAction: HandleAction = useCallback(
    (action, target, focus, args) => {
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
    },
    [updateNode],
  );
  useEffect(() => {
    if (
      focusedParentIndexEntry.node instanceof RequiredHoleNode &&
      focusedParentIndexEntry.node.actions.setVariant
    ) {
      handleAction(
        focusedParentIndexEntry.node.actions.setVariant,
        focusedParentIndexEntry.path.map((e) => e.childKey),
        (n) => n.id,
        {},
      );
    }
  }, [handleAction, focusedParentIndexEntry]);
  const navTree = useMemo(() => buildDivetreeNavTree(tree), [tree]);
  const focusedNode = focusedParentIndexEntry.node;
  incrementalParentIndex.addObservation(focusedNode);
  const [copiedNode, setCopiedNode] = useState<Node<unknown>>();
  const [marks, setMarks] = useState<Marks>({});
  const [chord, setChord] = useState<string[]>([]);
  const [expandView, setExpandView] = useState(false);
  const postLayoutHintsByIdRef = useRef(new Map<string, PostLayoutHints>());
  const labelMeasurementCacheRef = useRef<LabelMeasurementCache>();
  const displayTreeCacheRef = useRef(
    new Map<Node<unknown>, DisplayTreeCacheEntry>(),
  );
  const queueInput = useDelayedInput((input) => {
    switch (input.kind) {
      case DelayedInputKind.KeyDown:
        handleKey(input.event, {
          parentIndex: incrementalParentIndex,
          postLayoutHintsById: postLayoutHintsByIdRef.current,
          focusedId: focusedParentIndexEntry.node.id,
          setFocusedId,
          setFocusedIdPath,
          handleAction,
          cancelAction: () => setInProgressAction(undefined),
          actionInProgress: !!inProgressAction,
          copyNode: setCopiedNode,
          copiedNode,
          saveFile,
          marks,
          setMarks,
          chord,
          setChord,
          setExpandView,
        });
        break;
      case DelayedInputKind.KeyUp:
        if (input.event.key === "Shift") {
          setExpandView(false);
        }
        break;
      default:
        return unreachable(input);
    }
  });
  return (
    <div>
      <NavTree
        navTree={navTree}
        getDisplayTree={(focusPath) => {
          postLayoutHintsByIdRef.current = new Map();
          if (!labelMeasurementCacheRef.current) {
            labelMeasurementCacheRef.current = new LabelMeasurementCache(
              makeTextMeasurementFunctionsByStyle(),
            );
          }
          labelMeasurementCacheRef.current.clearUnused();

          return buildDivetreeDisplayTree(
            tree,
            {
              measureLabel: labelMeasurementCacheRef.current.measure,
              displayTreeCache: displayTreeCacheRef.current,
              incrementalParentIndex,
            },
            {
              focusPath,
              expandView,
              showNavigationHints: false,
              showShortcuts: false,
              postLayoutHintsById: postLayoutHintsByIdRef.current,
            },
          );
        }}
        getContent={(id) => (
          <NodeContent
            parentIndexEntry={incrementalParentIndex.get(id as string)}
            postLayoutHints={postLayoutHintsByIdRef.current.get(id as string)}
          />
        )}
        getStyle={(id, focused) =>
          getNodeStyle(
            incrementalParentIndex.get(id as string),
            postLayoutHintsByIdRef.current.get(id as string),
            focused,
          )
        }
        focusedIdPath={idPathFromParentIndexEntry(focusedParentIndexEntry)}
        onFocusedIdChange={setFocusedId}
        disableNav={!!inProgressAction}
        onKeyDown={(event) => {
          if (!inProgressAction || event.key === "Escape") {
            queueInput({ kind: DelayedInputKind.KeyDown, event });
          }
          return event.key.startsWith("Arrow") && !event.ctrlKey;
        }}
        onKeyUp={(event) => {
          if (event.key === "Shift") {
            queueInput({ kind: DelayedInputKind.KeyUp, event });
          }
        }}
        onRectClick={(ev, id) => {
          if (window.getSelection()?.toString()) {
            return;
          }
          ev.preventDefault();
          setFocusedId(id as string);
        }}
      />
      {inProgressAction && (
        <ActionFiller
          action={inProgressAction.action}
          onCancel={() => setInProgressAction(undefined)}
          onApply={onActionApply}
        />
      )}
      {!inProgressAction && (
        <PossibleActionDisplay actions={focusedNode?.actions || {}} />
      )}
    </div>
  );
};
