import { Node } from "./tree/node";
import {
  ParentIndexEntry,
  ParentPathElement,
  ParentIndex,
} from "./tree/display-new";

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

export class ParentIndexProxy {
  private static warningCount = 0;

  constructor(
    private oldIndex: ParentIndex,
    private incrementalIndex: IncrementalParentIndex,
  ) {}

  private static entriesAreEqual(
    entryA: ParentIndexEntry | undefined,
    entryB: ParentIndexEntry | undefined,
  ): boolean {
    if (!!entryA !== !!entryB) {
      return false;
    }
    if (!entryA || !entryB) {
      return true;
    }
    if (entryA.node !== entryB.node) {
      return false;
    }
    if (entryA.path.length !== entryB.path.length) {
      return false;
    }
    return entryA.path.every((eA, i) => {
      const eB = entryB.path[i];
      return eA.parent === eB.parent && eA.childKey === eB.childKey;
    });
  }

  private warn(...args: any[]) {
    if (ParentIndexProxy.warningCount >= 100) {
      return;
    }
    ParentIndexProxy.warningCount++;
    console.warn(...args);
  }

  get(nodeId: string) {
    const oldRes = this.oldIndex.get(nodeId);
    const incrementalRes = this.incrementalIndex.get(nodeId);
    if (!ParentIndexProxy.entriesAreEqual(oldRes, incrementalRes)) {
      this.warn(
        "ParentIndexProxy.get mismatch",
        nodeId,
        oldRes,
        incrementalRes,
      );
    }
    return oldRes;
  }

  has(nodeId: string) {
    const oldRes = this.oldIndex.has(nodeId);
    const incrementalRes = this.incrementalIndex.has(nodeId);
    if (oldRes !== incrementalRes) {
      this.warn(
        "ParentIndexProxy.has mismatch",
        nodeId,
        oldRes,
        incrementalRes,
      );
    }
    return oldRes;
  }
}
