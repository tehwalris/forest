import { Doc, ListKind, ListNode, Node, NodeKind, Path } from "./interfaces";
import { nodeTryGetDeepestByPath } from "./tree-utils/access";

export const emptyDoc: Doc = {
  root: {
    kind: NodeKind.List,
    listKind: ListKind.File,
    delimiters: ["", ""],
    content: [],
    equivalentToContent: true,
    pos: 0,
    end: 0,
  },
  text: "",
};

export function docMapRoot(doc: Doc, cb: (node: ListNode) => Node): Doc {
  const newRoot = cb(doc.root);
  if (newRoot === doc.root) {
    return doc;
  }
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("newRoot must be a ListNode");
  }
  return { ...doc, root: newRoot };
}

export function getBeforePos(doc: Doc, beforePath: Path): number {
  const deepest = nodeTryGetDeepestByPath(doc.root, beforePath);
  if (deepest.path.length === beforePath.length) {
    return deepest.node.pos;
  }
  let pos = deepest.node.end;
  if (deepest.node.kind === NodeKind.List) {
    pos -= deepest.node.delimiters[1].length;
  }
  return pos;
}
