import {
  IncrementalParentIndex,
  ParentIndexEntry,
  idPathFromParentIndexEntry,
} from "./parent-index";
import { Node } from "./tree/node";
import { useState } from "react";
import * as R from "ramda";

function getValidPath(
  idPath: string[],
  tree: Node<unknown>,
  parentIndex: IncrementalParentIndex,
): { path: string[]; changed: boolean } {
  parentIndex.addObservation(tree);
  let validIdPath = _getValidPath(idPath, tree, parentIndex);
  let changed = validIdPath.length !== idPath.length;
  if (!validIdPath.length) {
    validIdPath = [tree.id];
    changed = true;
  }
  return { path: validIdPath, changed };
}

function _getValidPath(
  path: string[],
  subtree: Node<unknown>,
  parentIndex: IncrementalParentIndex,
): string[] {
  if (!path.length || path[0] !== subtree.id) {
    return [];
  }
  parentIndex.addObservation(subtree);
  const possiblePaths = subtree.children.map(c =>
    _getValidPath(path.slice(1), c.node, parentIndex),
  );
  return [path[0], ...(possiblePaths.find(p => p.length) || [])];
}

export function useFocus(
  tree: Node<unknown>,
  parentIndex: IncrementalParentIndex,
): [ParentIndexEntry, (id: string) => void] {
  const [_focusedIdPath, _setFocusedIdPath] = useState([tree.id]);
  const [nextFocusedId, setNextFocusedId] = useState<string>();

  let { path: focusedIdPath, changed } = getValidPath(
    _focusedIdPath,
    tree,
    parentIndex,
  );

  if (nextFocusedId !== undefined) {
    // HACK This is necessary so that focusing a child that was
    // just appended to a MetaBranchNode works correctly,
    // since those are actually one level deeper than they appear.
    parentIndex.get(R.last(focusedIdPath)!)?.node.children.forEach(c => {
      parentIndex.addObservation(c.node);
    });

    const entry = parentIndex.get(nextFocusedId);
    if (entry) {
      focusedIdPath = idPathFromParentIndexEntry(entry);
      changed = true;
      setNextFocusedId(undefined);
    } else {
      console.warn("targetId is not in parentIndex", nextFocusedId);
    }
  }

  if (changed) {
    _setFocusedIdPath(focusedIdPath);
  }

  const setFocusedId = (targetId: string) => {
    const entry = parentIndex.get(targetId);
    if (entry && nextFocusedId === undefined) {
      _setFocusedIdPath(idPathFromParentIndexEntry(entry));
    } else {
      setNextFocusedId(targetId);
    }
  };

  const focusedIndexEntry = parentIndex.get(R.last(focusedIdPath)!)!;

  return [focusedIndexEntry, setFocusedId];
}
