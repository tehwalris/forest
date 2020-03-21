import { Node } from "./tree/node";
import * as R from "ramda";

interface ParentLink {
  parentId: string;
  childKey: string;
}

export type ParentPathElement = { parent: Node<unknown>; childKey: string };

export interface ParentIndex {
  get(nodeId: string): ParentIndexEntry | undefined;
  has(nodeId: string): boolean;
}

export type ParentIndexEntry = {
  node: Node<unknown>;
  path: ParentPathElement[];
};

export function nodePathFromParentIndexEntry(
  entry: ParentIndexEntry,
  filterCb?: (
    node: Node<unknown>,
    parent: Node<unknown> | undefined,
  ) => boolean,
): Node<unknown>[] {
  let nodePath = [...entry.path.map(e => e.parent), entry.node];
  if (filterCb) {
    nodePath = nodePath.filter((n, i) =>
      filterCb(n, i > 0 ? nodePath[i - 1] : undefined),
    );
  }
  return nodePath;
}

export function idPathFromParentIndexEntry(
  entry: ParentIndexEntry,
  filterCb?: (
    node: Node<unknown>,
    parent: Node<unknown> | undefined,
  ) => boolean,
): string[] {
  return nodePathFromParentIndexEntry(entry, filterCb).map(e => e.id);
}

export class IncrementalParentIndex {
  private observedNodes = new Set<Node<unknown>>();
  private nodesById = new Map<string, Node<unknown>>();
  private parentLinksByChildId = new Map<string, ParentLink>();
  private entriesByNodeId = new Map<string, ParentIndexEntry>();

  constructor(private tree: Node<unknown>) {}

  addObservation(node: Node<unknown>) {
    if (this.observedNodes.has(node)) {
      return;
    }
    this.observedNodes.add(node);

    this.nodesById.set(node.id, node);
    node.children.forEach(c => {
      this.nodesById.set(c.node.id, c.node);
      this.addLinkObservation(node.id, c.node.id, c.key);
    });
  }

  private addLinkObservation(
    parentId: string,
    childId: string,
    childKey: string,
  ) {
    this.parentLinksByChildId.set(childId, { parentId, childKey });
  }

  get(nodeId: string): ParentIndexEntry | undefined {
    const cached = this.entriesByNodeId.get(nodeId);
    if (cached) {
      return cached;
    }
    const uncached = this.getUncached(nodeId);
    if (uncached && nodePathFromParentIndexEntry(uncached)[0] === this.tree) {
      this.entriesByNodeId.set(nodeId, uncached);
    }
    return uncached;
  }

  private getUncached(nodeId: string): ParentIndexEntry | undefined {
    const node = this.nodesById.get(nodeId);
    if (!node) {
      return undefined;
    }

    const path: ParentPathElement[] = [];
    let currentId = nodeId;
    while (true) {
      const link = this.parentLinksByChildId.get(currentId);
      if (!link) {
        break;
      }
      const parent = this.nodesById.get(link.parentId);
      if (!parent) {
        break;
      }
      path.push({ parent, childKey: link.childKey });
      currentId = parent.id;
    }
    path.reverse();

    return { node, path };
  }

  has(nodeId: string): boolean {
    return this.nodesById.has(nodeId);
  }
}
