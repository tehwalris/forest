import {
  NavNode,
  NodeKind,
  PortalNode,
  RootNode as DivetreeDisplayRootNode,
  Split,
  TightLeafNode,
  TightNode,
} from "divetree-core";
import { IncrementalParentIndex } from "../parent-index";
import { BuildDivetreeDisplayTreeArgs, LabelStyle, Node } from "../tree/node";
import { PostLayoutHints } from "../layout-hints";
import * as R from "ramda";
import { LabelMeasurementFunction } from "../text-measurement";
import {
  divetreeFromDoc,
  Doc,
  docIsOnlySoftLinesOrEmpty,
  leafDoc,
} from "./display-line";
import { unreachable } from "../util";

function maybeWrapPortal(
  node: DivetreeDisplayRootNode,
): TightNode | PortalNode {
  return node.kind === NodeKind.TightLeaf || node.kind === NodeKind.TightSplit
    ? node
    : { kind: NodeKind.Portal, id: `${node.id}-portal`, child: node };
}

enum IntermediateDisplayKind {
  Doc,
  Divetree,
}

type IntermediateDisplay =
  | { kind: IntermediateDisplayKind.Doc; content: Doc }
  | {
      kind: IntermediateDisplayKind.Divetree;
      content: DivetreeDisplayRootNode;
      considerEmpty?: boolean;
    };

function isConsideredEmpty(intermediate: IntermediateDisplay): boolean {
  switch (intermediate.kind) {
    case IntermediateDisplayKind.Divetree:
      return intermediate.considerEmpty || false;
    case IntermediateDisplayKind.Doc:
      return docIsOnlySoftLinesOrEmpty(intermediate.content);
    default:
      return unreachable(intermediate);
  }
}

export function buildDivetreeDisplayTree(
  ...args: Parameters<typeof buildDivetreeDisplayTreeNonCacheable>
): DivetreeDisplayRootNode {
  return asDivetree(buildDivetreeDisplayTreeNonCacheable(...args));
}

function asDivetree(
  intermediate: IntermediateDisplay,
): DivetreeDisplayRootNode {
  switch (intermediate.kind) {
    case IntermediateDisplayKind.Divetree:
      return intermediate.content;
    case IntermediateDisplayKind.Doc:
      return divetreeFromDoc(intermediate.content);
    default:
      return unreachable(intermediate);
  }
}

function asDoc(intermediate: IntermediateDisplay): Doc {
  switch (intermediate.kind) {
    case IntermediateDisplayKind.Divetree:
      return leafDoc(
        maybeWrapPortal(intermediate.content),
        isConsideredEmpty(intermediate),
      );
    case IntermediateDisplayKind.Doc:
      return intermediate.content;
    default:
      return unreachable(intermediate);
  }
}

function buildFinalGenericDisplayTree(
  node: Node<unknown>,
): IntermediateDisplay {
  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [150, 56],
  };

  if (!node.children.length) {
    return {
      kind: IntermediateDisplayKind.Divetree,
      content: base,
    };
  }

  return {
    kind: IntermediateDisplayKind.Divetree,
    content: {
      kind: NodeKind.TightSplit,
      split: Split.SideBySide,
      children: [
        base,
        {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: node.children.slice(0, 4).map(
            (c): TightLeafNode => ({
              kind: NodeKind.TightLeaf,
              id: c.node.id,
              size: [75, 25],
            }),
          ),
        },
      ],
    },
  };
}

export interface DisplayTreeCacheEntry {
  intermediateDisplay: IntermediateDisplay;
  subtreePostLayoutHintsById: Map<string, PostLayoutHints>;
}

interface DisplayTreeCacheableArgs {
  measureLabel: LabelMeasurementFunction;
  displayTreeCache: WeakMap<Node<unknown>, DisplayTreeCacheEntry>;
  incrementalParentIndex: IncrementalParentIndex;
}

function buildDivetreeDisplayTreeCacheable(
  node: Node<unknown>,
  args: DisplayTreeCacheableArgs,
): DisplayTreeCacheEntry {
  const { measureLabel, displayTreeCache, incrementalParentIndex } = args;

  const oldCacheEntry = displayTreeCache.get(node);
  if (oldCacheEntry) {
    return oldCacheEntry;
  }

  incrementalParentIndex.addObservation(node);
  const parentPath = incrementalParentIndex.get(node.id)?.path;
  if (!parentPath) {
    throw new Error(
      "could not get parentPath for node that was just added to index",
    );
  }

  const subtreePostLayoutHintsById = new Map<string, PostLayoutHints>();
  const updatePostLayoutHints: BuildDivetreeDisplayTreeArgs["updatePostLayoutHints"] =
    (id, updateHints) => {
      const oldHints: PostLayoutHints =
        subtreePostLayoutHintsById.get(id) || {};
      const newHints: PostLayoutHints = updateHints(oldHints);
      subtreePostLayoutHintsById.set(id, newHints);
    };

  const beforeReturn = (
    intermediateDisplay: IntermediateDisplay,
  ): DisplayTreeCacheEntry => {
    const newCacheEntry: DisplayTreeCacheEntry = {
      intermediateDisplay,
      subtreePostLayoutHintsById,
    };
    displayTreeCache.set(node, newCacheEntry);
    return newCacheEntry;
  };

  const buildChildDoc: BuildDivetreeDisplayTreeArgs["buildChildDoc"] = (
    childNode: Node<unknown>,
  ) => {
    const childCacheEntry = buildDivetreeDisplayTreeCacheable(childNode, args);
    for (const [id, hints] of childCacheEntry.subtreePostLayoutHintsById) {
      subtreePostLayoutHintsById.set(id, hints);
    }
    return asDoc(childCacheEntry.intermediateDisplay);
  };

  const customDoc = node.buildDoc({
    focusPath: [],
    expand: false,
    showChildNavigationHints: false,
    parentPath,
    buildChildDoc,
    updatePostLayoutHints,
    measureLabel,
  });
  if (customDoc) {
    return beforeReturn({
      kind: IntermediateDisplayKind.Doc,
      content: customDoc,
    });
  }

  return beforeReturn(buildFinalGenericDisplayTree(node));
}

interface DisplayTreeNonCacheableArgs {
  focusPath: string[];
  expandView: boolean;
  showNavigationHints: boolean;
  showShortcuts: boolean;
  postLayoutHintsById: Map<string, PostLayoutHints>;
}

function buildDivetreeDisplayTreeNonCacheable(
  node: Node<unknown>,
  cacheableArgs: DisplayTreeCacheableArgs,
  nonCacheableArgs: DisplayTreeNonCacheableArgs,
): IntermediateDisplay {
  const { measureLabel, incrementalParentIndex } = cacheableArgs;
  const {
    focusPath,
    expandView,
    showNavigationHints,
    showShortcuts,
    postLayoutHintsById,
  } = nonCacheableArgs;

  incrementalParentIndex.addObservation(node);
  const parentPath = incrementalParentIndex.get(node.id)?.path;
  if (!parentPath) {
    throw new Error(
      "could not get parentPath for node that was just added to index",
    );
  }

  function maybeWrapForNavigation(
    base: IntermediateDisplay,
  ): IntermediateDisplay {
    if (!showNavigationHints && !showShortcuts) {
      return base;
    }

    const parentEntry = parentPath && R.last(parentPath);
    if (!parentEntry) {
      console.warn(
        "parent not found for node that has showNavigationHints or showShortcuts",
      );
      return base;
    }
    const childKey = parentEntry.childKey;
    let childKeyForDisplay = childKey;
    if (childKey.match(/^\d+$/)) {
      // HACK
      childKeyForDisplay = `${1 + +childKey}`;
    }
    const childShortcut = [
      ...parentEntry.parent.getChildShortcuts().entries(),
    ].find(([k, p]) => p.length === 1 && p[0] === childKey)?.[0];
    if (childShortcut) {
      childKeyForDisplay += ` (${childShortcut})`;
    }

    if (showNavigationHints) {
      postLayoutHintsById.set(`${node.id}-navigation`, {
        label: [{ text: childKeyForDisplay, style: LabelStyle.CHILD_KEY }],
      });
      return {
        kind: IntermediateDisplayKind.Divetree,
        content: {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: [
            {
              kind: NodeKind.TightLeaf,
              id: `${node.id}-navigation`,
              size: [150, 20],
            },
            maybeWrapPortal(asDivetree(base)),
          ],
        },
      };
    } else {
      if (!childShortcut) {
        return base;
      }
      postLayoutHintsById.set(`${node.id}-shortcut`, {
        shortcutKey: childShortcut,
      });
      return {
        kind: IntermediateDisplayKind.Doc,
        content: [
          leafDoc(
            {
              kind: NodeKind.TightLeaf,
              id: `${node.id}-shortcut`,
              size: [0, 0],
            },
            true,
          ),
          asDoc(base),
        ],
      };
    }
  }

  const isOnFocusPath = !!focusPath.length && node.id === focusPath[0];
  if (!isOnFocusPath) {
    const { intermediateDisplay, subtreePostLayoutHintsById } =
      buildDivetreeDisplayTreeCacheable(node, cacheableArgs);
    for (const [id, hints] of subtreePostLayoutHintsById) {
      postLayoutHintsById.set(id, hints);
    }
    return maybeWrapForNavigation(intermediateDisplay);
  }

  const showChildNavigationHints = focusPath.length === 1 && expandView;
  const showChildShortcuts = focusPath.length === 1 && !expandView;
  const buildChildIntermediate = (childNode: Node<unknown>) =>
    buildDivetreeDisplayTreeNonCacheable(childNode, cacheableArgs, {
      focusPath: focusPath.slice(1),
      expandView,
      showNavigationHints: showChildNavigationHints,
      showShortcuts: showChildShortcuts,
      postLayoutHintsById,
    });

  const updatePostLayoutHints: BuildDivetreeDisplayTreeArgs["updatePostLayoutHints"] =
    (id, updateHints) => {
      const oldHints: PostLayoutHints = postLayoutHintsById.get(id) || {};
      const newHints: PostLayoutHints = updateHints(oldHints);
      postLayoutHintsById.set(id, newHints);
    };

  const customIntermediateArgs: BuildDivetreeDisplayTreeArgs = {
    focusPath,
    expand: isOnFocusPath,
    showChildNavigationHints,
    parentPath,
    buildChildDoc: (childNode) => asDoc(buildChildIntermediate(childNode)),
    updatePostLayoutHints,
    measureLabel,
  };
  const customDoc = node.buildDoc(customIntermediateArgs);
  if (customDoc) {
    return maybeWrapForNavigation({
      kind: IntermediateDisplayKind.Doc,
      content: customDoc,
    });
  }

  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [150, 56],
  };
  if (!node.children.length) {
    // HACK returning an loose node with no children instead breaks some code that expects tight nodes
    return maybeWrapForNavigation({
      kind: IntermediateDisplayKind.Divetree,
      content: base,
    });
  }
  return {
    kind: IntermediateDisplayKind.Divetree,
    content: {
      kind: NodeKind.Loose,
      id: node.id + "-loose", // HACK This suffix wont work if "id" is an arbitrary string
      parent: asDivetree(
        maybeWrapForNavigation({
          kind: IntermediateDisplayKind.Divetree,
          content: base,
        }),
      ) as typeof base | TightNode, // HACK Properly preserving the type here is impractical
      children: node.children.map((c) =>
        asDivetree(buildChildIntermediate(c.node)),
      ),
    },
  };
}

export function buildDivetreeNavTree(
  node: Node<unknown>,
  incrementalParentIndex?: IncrementalParentIndex,
): NavNode {
  if (incrementalParentIndex) {
    incrementalParentIndex.addObservation(node);
  }
  return {
    id: node.id,
    getChildren: () =>
      node.children.map((c) =>
        buildDivetreeNavTree(c.node, incrementalParentIndex),
      ),
  };
}
