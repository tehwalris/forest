import { TextRange } from "typescript";
import { Doc, EvenPathRange, Node, NodeKind, Path } from "./interfaces";
import { getSmallestContainingRange } from "./path-utils";
import { Insertion, makeNewPosFromOldPosForInsertions } from "./text";
import { nodeVisitDeep } from "./tree-utils/access";
import { isToken, isTsQuestionDotToken } from "./ts-type-predicates";
interface CheckInsertionArgs {
  newDoc: Doc;
  oldDoc: Doc;
  insertions: Insertion[];
}
interface ValidCheckedInsertion {
  valid: true;
  newNodesByOldTraceableNodes: Map<Node, Node>;
  insertionPathRanges: EvenPathRange[];
}
interface InvalidCheckedInsertion {
  valid: false;
  reason: string;
}
type CheckedInsertion = ValidCheckedInsertion | InvalidCheckedInsertion;
class InvalidInsertionError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
export function checkInsertion(args: CheckInsertionArgs): CheckedInsertion {
  try {
    return _checkInsertion(args);
  } catch (err) {
    if (err instanceof InvalidInsertionError) {
      return { valid: false, reason: err.message };
    } else {
      throw err;
    }
  }
}
function isNodeTraceable(node: Node): boolean {
  if (node.kind === NodeKind.List && node.equivalentToContent) {
    return false;
  }
  return true;
}
function _checkInsertion({
  newDoc,
  oldDoc,
  insertions,
}: CheckInsertionArgs): ValidCheckedInsertion {
  const newPosFromOldPos = makeNewPosFromOldPosForInsertions(insertions);
  const newNodesByPos = new Map<number, Node[]>();
  const unmatchedNewNodes = new Set<Node>();
  nodeVisitDeep(newDoc.root, (newNode) => {
    const nodesAtPos = newNodesByPos.get(newNode.pos) || [];
    newNodesByPos.set(newNode.pos, nodesAtPos);
    nodesAtPos.push(newNode);
    unmatchedNewNodes.add(newNode);
  });
  const newNodesByOldTraceableNodes = new Map<Node, Node>();
  nodeVisitDeep(oldDoc.root, (oldNode) => {
    if (!isNodeTraceable(oldNode)) {
      return;
    }
    if (oldNode.pos > oldNode.end) {
      throw new Error("node has negative length text range");
    }
    if (oldNode.pos === oldNode.end && oldNode.isPlaceholder) {
      throw new Error("placeholder node has zero length text range");
    }
    const expectedRange = {
      pos: newPosFromOldPos(oldNode.pos),
      end: newPosFromOldPos(oldNode.end - 1) + 1,
    };
    const nodesAtPos = newNodesByPos.get(expectedRange.pos) || [];
    const matchingNodes = nodesAtPos.filter(
      (newNode) => newNode.end === expectedRange.end,
    );
    const newNode = matchingNodes.find(
      (node) =>
        unmatchedNewNodes.has(node) &&
        (node.kind !== NodeKind.List || !node.equivalentToContent),
    );
    if (!newNode) {
      throw new InvalidInsertionError(
        "no new nodes matched this old node, expected at least 1",
      );
    }
    unmatchedNewNodes.delete(newNode);
    newNodesByOldTraceableNodes.set(oldNode, newNode);
  });
  const insertionTextRanges: TextRange[] = insertions.map((insertion) => {
    const end = newPosFromOldPos(insertion.beforePos, insertion.duplicateIndex);
    const pos = end - insertion.text.length;
    return { pos, end };
  });
  const insertedPathsByInsertion: Path[][] = insertions.map(() => []);
  nodeVisitDeep(newDoc.root, (newNode, path) => {
    let nodeRange: TextRange = newNode;
    if (isToken(newNode, isTsQuestionDotToken)) {
      nodeRange = { pos: nodeRange.pos, end: nodeRange.pos + 1 };
    }
    const i = insertionTextRanges.findIndex(
      (insertionRange) =>
        nodeRange.pos >= insertionRange.pos &&
        nodeRange.end <= insertionRange.end,
    );
    if (i !== -1) {
      insertedPathsByInsertion[i].push(path);
    }
  });
  if (insertedPathsByInsertion.some((paths) => !paths.length)) {
    throw new InvalidInsertionError("some insertions did not add any nodes");
  }
  const insertionPathRanges = insertedPathsByInsertion.map((paths) =>
    getSmallestContainingRange(paths),
  );
  return { valid: true, newNodesByOldTraceableNodes, insertionPathRanges };
}
