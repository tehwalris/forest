import { Node } from "./tree/node";
import { ParentIndexEntry, ParentPathElement } from "./tree/display-new";

interface ParentLink {
  parentId: string;
  childKey: string;
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
