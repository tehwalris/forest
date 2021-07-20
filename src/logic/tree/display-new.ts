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
import { isMetaBranchNode } from "../transform/transforms/split-meta";
import { BuildDivetreeDisplayTreeArgs, LabelStyle, Node } from "../tree/node";
import { PostLayoutHints } from "../layout-hints";
import * as R from "ramda";

export function getNodeForDisplay(
  node: Node<unknown>,
  metaLevelNodeIds: Set<string>,
): Node<unknown> {
  if (isMetaBranchNode(node)) {
    const selectedBranch = metaLevelNodeIds.has(node.id) ? "meta" : "primary";
    return node.children.find((c) => c.key === selectedBranch)!.node;
  }
  return node;
}

export function buildDivetreeDisplayTree(
  node: Node<unknown>,
  focusPath: string[],
  extraDepth: number,
  metaLevelNodeIds: Set<string>,
  incrementalParentIndex: IncrementalParentIndex,
  postLayoutHintsById: Map<string, PostLayoutHints>,
): DivetreeDisplayRootNode {
  const updatePostLayoutHints: BuildDivetreeDisplayTreeArgs["updatePostLayoutHints"] =
    (id, updateHints) => {
      const oldHints: PostLayoutHints = postLayoutHintsById.get(id) || {};
      postLayoutHintsById.set(id, updateHints(oldHints));
    };

  const isOnFocusPath = node.id === focusPath[0];
  const isFinal = !isOnFocusPath || !!extraDepth;
  const showChildNavigationHints = isOnFocusPath && focusPath.length === 1;

  const nodeForDisplay = getNodeForDisplay(node, metaLevelNodeIds);
  const children = nodeForDisplay.children;

  incrementalParentIndex.addObservation(node);
  incrementalParentIndex.addObservation(nodeForDisplay);
  const parentPath = incrementalParentIndex.get(nodeForDisplay.id)?.path;
  if (!parentPath) {
    throw new Error(
      "could not get parentPath for node that was just added to index",
    );
  }

  if (showChildNavigationHints) {
    for (const { node: childNode } of nodeForDisplay.children) {
      updatePostLayoutHints(childNode.id, (oldHints) => ({
        ...oldHints,
        showNavigationHints: true,
      }));
    }
  }

  function maybeWrapPortal(
    node: DivetreeDisplayRootNode,
  ): TightNode | PortalNode {
    return node.kind === NodeKind.TightLeaf || node.kind === NodeKind.TightSplit
      ? node
      : { kind: NodeKind.Portal, id: `${node.id}-portal`, child: node };
  }

  function maybeWrapForNavigation<T extends DivetreeDisplayRootNode>(
    base: T,
  ): T | TightNode {
    if (!postLayoutHintsById.get(nodeForDisplay.id)?.showNavigationHints) {
      return base;
    }

    const childKey = R.last(parentPath!)?.childKey;
    if (!childKey) {
      console.warn("parent not found for node that has showNavigationHints");
      return base;
    }
    let navigationText = childKey;
    if (childKey.match(/^\d+$/)) {
      // HACK
      navigationText = `${1 + +childKey}`;
    }
    updatePostLayoutHints(`${nodeForDisplay.id}-navigation`, (oldHints) => ({
      ...oldHints,
      label: [{ text: navigationText, style: LabelStyle.UNKNOWN }],
    }));

    return {
      kind: NodeKind.TightSplit,
      split: Split.Stacked,
      children: [
        {
          kind: NodeKind.TightLeaf,
          id: `${nodeForDisplay.id}-navigation`,
          size: [150, 20],
        },
        maybeWrapPortal(base),
      ],
    };
  }

  const buildChildDisplayTree = (childNode: Node<unknown>) =>
    buildDivetreeDisplayTree(
      childNode,
      isOnFocusPath ? focusPath.slice(1) : [],
      extraDepth + (isOnFocusPath ? 0 : 1),
      metaLevelNodeIds,
      incrementalParentIndex,
      postLayoutHintsById,
    );

  const customDisplayTree = node.buildDivetreeDisplayTree({
    nodeForDisplay,
    isOnFocusPath,
    isFinal,
    parentPath,
    buildChildDisplayTree,
    updatePostLayoutHints,
  });
  if (customDisplayTree) {
    return maybeWrapForNavigation(customDisplayTree);
  }

  const base: TightLeafNode = {
    kind: NodeKind.TightLeaf,
    id: node.id,
    size: [150, 56],
  };

  if (isFinal) {
    if (!children.length) {
      return maybeWrapForNavigation(base);
    }
    return maybeWrapForNavigation({
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
    });
  }

  if (!children.length) {
    // HACK returning an loose node with no children instead breaks some code that expects tight nodes
    return maybeWrapForNavigation(base);
  }

  return {
    kind: NodeKind.Loose,
    id: node.id + "-loose", // HACK This suffix wont work if "id" is an arbitrary string
    parent: maybeWrapForNavigation(base),
    children: children.map((c) => buildChildDisplayTree(c.node)),
  };
}

export function buildDivetreeNavTree(
  node: Node<unknown>,
  metaLevelNodeIds: Set<string>,
  incrementalParentIndex?: IncrementalParentIndex,
): NavNode {
  const nodeForDisplay = getNodeForDisplay(node, metaLevelNodeIds);
  if (incrementalParentIndex) {
    incrementalParentIndex.addObservation(node);
    incrementalParentIndex.addObservation(nodeForDisplay);
  }
  return {
    id: node.id,
    getChildren: () =>
      nodeForDisplay.children.map((c) =>
        buildDivetreeNavTree(c.node, metaLevelNodeIds, incrementalParentIndex),
      ),
  };
}
