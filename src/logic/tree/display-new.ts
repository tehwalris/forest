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
  ...args: Parameters<typeof buildDivetreeDisplayTreeIntermediate>
): DivetreeDisplayRootNode {
  return asDivetree(buildDivetreeDisplayTreeIntermediate(...args));
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

function buildDivetreeDisplayTreeIntermediate(
  node: Node<unknown>,
  focusPath: string[],
  incrementalParentIndex: IncrementalParentIndex,
  postLayoutHintsById: Map<string, PostLayoutHints>,
  measureLabel: LabelMeasurementFunction,
  expandView: boolean,
): IntermediateDisplay {
  const updatePostLayoutHints: BuildDivetreeDisplayTreeArgs["updatePostLayoutHints"] =
    (id, updateHints) => {
      const oldHints: PostLayoutHints = postLayoutHintsById.get(id) || {};
      postLayoutHintsById.set(id, updateHints(oldHints));
    };

  const isOnFocusPath = !!focusPath.length && node.id === focusPath[0];
  const isFinal = !isOnFocusPath;

  // HACK disable navigation for now to prevent document tree from breaking due to conversions
  const showChildNavigationHints =
    expandView && isOnFocusPath && focusPath.length === 1;
  const showChildShortcuts =
    !showChildNavigationHints && isOnFocusPath && focusPath.length === 1;

  const children = node.children;

  incrementalParentIndex.addObservation(node);
  const parentPath = incrementalParentIndex.get(node.id)?.path;
  if (!parentPath) {
    throw new Error(
      "could not get parentPath for node that was just added to index",
    );
  }

  if (showChildNavigationHints) {
    for (const { node: childNode } of node.children) {
      updatePostLayoutHints(childNode.id, (oldHints) => ({
        ...oldHints,
        showNavigationHints: true,
      }));
    }
  }
  if (showChildShortcuts) {
    for (const { node: childNode } of node.children) {
      updatePostLayoutHints(childNode.id, (oldHints) => ({
        ...oldHints,
        showShortcuts: true,
      }));
    }
  }

  function maybeWrapForNavigation(
    base: IntermediateDisplay,
  ): IntermediateDisplay {
    let { showNavigationHints, showShortcuts } =
      postLayoutHintsById.get(node.id) || {};
    if (!showNavigationHints && !showShortcuts) {
      return base;
    }
    if (showNavigationHints) {
      // it doesn't make sense to show both
      showShortcuts = false;
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
      updatePostLayoutHints(`${node.id}-navigation`, (oldHints) => ({
        ...oldHints,
        label: [{ text: childKeyForDisplay, style: LabelStyle.CHILD_KEY }],
      }));

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

      updatePostLayoutHints(`${node.id}-shortcut`, (oldHints) => ({
        ...oldHints,
        shortcutKey: childShortcut,
      }));

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

  const buildChildIntermediate = (childNode: Node<unknown>) =>
    buildDivetreeDisplayTreeIntermediate(
      childNode,
      isOnFocusPath ? focusPath.slice(1) : [],
      incrementalParentIndex,
      postLayoutHintsById,
      measureLabel,
      expandView,
    );
  const buildChildDisplayTree = (childNode: Node<unknown>) =>
    asDivetree(buildChildIntermediate(childNode));
  const buildChildDoc = (childNode: Node<unknown>) =>
    asDoc(buildChildIntermediate(childNode));

  const customIntermediateArgs: BuildDivetreeDisplayTreeArgs = {
    focusPath,
    expand: isOnFocusPath,
    showChildNavigationHints,
    parentPath,
    buildChildDoc,
    updatePostLayoutHints,
    measureLabel,
  };
  const mapIfDefined = <A, B>(
    v: A | undefined,
    cb: (v: A) => B,
  ): B | undefined => (v === undefined ? undefined : cb(v));
  const customIntermediate: IntermediateDisplay | undefined = mapIfDefined(
    node.buildDoc(customIntermediateArgs),
    (content) => ({
      kind: IntermediateDisplayKind.Doc,
      content,
    }),
  );
  if (customIntermediate) {
    return maybeWrapForNavigation(customIntermediate);
  }

  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [150, 56],
  };

  if (isFinal) {
    if (!children.length) {
      return maybeWrapForNavigation({
        kind: IntermediateDisplayKind.Divetree,
        content: base,
      });
    }
    return maybeWrapForNavigation({
      kind: IntermediateDisplayKind.Divetree,
      content: {
        kind: NodeKind.TightSplit,
        split: Split.SideBySide,
        children: [
          base,
          {
            kind: NodeKind.TightSplit,
            split: Split.Stacked,
            children: children.slice(0, 4).map(
              (c): TightLeafNode => ({
                kind: NodeKind.TightLeaf,
                id: c.node.id,
                size: [75, 25],
              }),
            ),
          },
        ],
      },
    });
  }

  if (!children.length) {
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
      children: children.map((c) => buildChildDisplayTree(c.node)),
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
