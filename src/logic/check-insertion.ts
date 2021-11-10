import { Doc, Node } from "./interfaces";
import { Insertion, makeNewPosFromOldPosForInsertions } from "./text";
import { nodeVisitDeep } from "./tree-utils/access";

interface CheckInsertionArgs {
  newDoc: Doc;
  oldDoc: Doc;
  insertions: Insertion[];
}

interface ValidCheckedInsertion {
  valid: true;
  newNodesByOldNodes: Map<Node, Node>;
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

function _checkInsertion({
  newDoc,
  oldDoc,
  insertions,
}: CheckInsertionArgs): ValidCheckedInsertion {
  const newPosFromOldPos = makeNewPosFromOldPosForInsertions(insertions);

  const newNodesByPos = new Map<number, Node[]>();
  const unmatchedNewNodes = new Set<Node>();
  nodeVisitDeep(oldDoc.root, (newNode) => {
    const nodesAtPos = newNodesByPos.get(newNode.pos) || [];
    newNodesByPos.set(newNode.pos, nodesAtPos);
    nodesAtPos.push(newNode);
    unmatchedNewNodes.add(newNode);
  });

  const newNodesByOldNodes = new Map<Node, Node>();
  nodeVisitDeep(newDoc.root, (oldNode) => {
    const expectedRange = {
      pos: newPosFromOldPos(oldNode.pos),
      end: newPosFromOldPos(oldNode.end),
    };
    const nodesAtPos = newNodesByPos.get(expectedRange.pos) || [];
    const matchingNodes = nodesAtPos.filter(
      (newNode) => newNode.end === expectedRange.end,
    );
    if (matchingNodes.length !== 1) {
      throw new InvalidInsertionError(
        `${matchingNodes.length} new nodes matched this old node, expected exactly 1`,
      );
    }
    const newNode = matchingNodes[0];
    // TODO could check that the contents matches, but be careful to avoid exponential complexity

    const firstMatchWithThisNewNode = unmatchedNewNodes.delete(newNode);
    if (!firstMatchWithThisNewNode) {
      throw new InvalidInsertionError(
        "new node matched to more than 1 old node",
      );
    }

    newNodesByOldNodes.set(oldNode, newNode);
  });

  // TODO check new nodes and assign them to insertions
  // - either they are full within a single insertion range
  // - or they intersect exactly one insertion range and have equivalentToContent

  return { valid: true, newNodesByOldNodes };
}
