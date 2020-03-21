import { Node } from "./tree/node";

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

export function idPathFromParentIndexEntry(entry: ParentIndexEntry): string[] {
  return [...entry.path.map(e => e.parent), entry.node].map(e => e.id);
}

export class IncrementalParentIndex {
  private nodesById: Map<string, Node<unknown>> = new Map();
  private parentLinksByChildId: Map<string, ParentLink> = new Map();

  addObservation(node: Node<unknown>) {
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
