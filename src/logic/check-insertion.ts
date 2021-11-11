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
  newNodesByOldPlaceholderNodes: Map<Node, Node>;
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

  const newNodesByOldPlaceholderNodes = new Map<Node, Node>();
  nodeVisitDeep(oldDoc.root, (oldNode) => {
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

    // HACK By taking the first unmatched node, outer nodes will be matched before inner nodes.
    const newNode = matchingNodes.find((node) => unmatchedNewNodes.has(node));
    if (!newNode) {
      if (oldNode.kind === NodeKind.List && oldNode.equivalentToContent) {
        // HACK These kinds of lists may be next to a cursor and expand over the cursor due to the insertion.
        // This is generally fine, and when it's not fine (not sure when?) it's probably really hard to check.
        return;
      }
      throw new InvalidInsertionError(
        "no new nodes matched this old node, expected at least 1",
      );
    }
    unmatchedNewNodes.delete(newNode);

    // TODO could check that the contents matches, but be careful to avoid exponential complexity

    if (oldNode.isPlaceholder) {
      newNodesByOldPlaceholderNodes.set(oldNode, newNode);
    }
  });

  const insertionTextRanges: TextRange[] = insertions.map((insertion) => {
    const end = newPosFromOldPos(insertion.beforePos);
    const pos = end - insertion.text.length;
    return { pos, end };
  });

  const insertedPathsByInsertion: Path[][] = insertions.map(() => []);
  nodeVisitDeep(newDoc.root, (newNode, path) => {
    let nodeRange: TextRange = newNode;
    if (isToken(newNode, isTsQuestionDotToken)) {
      // HACK Inserting "?" before an existing "." (which we don't consider a
      // node) will create "?." (which we do consider a node), but the "." part
      // of this will be outside of the insertion range, which isn't allowed. We
      // want to allow this special case on purpose.
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

  // TODO check new nodes and assign them to insertions
  // - either they are fully within a single insertion range
  // - or they intersect exactly one insertion range and have equivalentToContent

  return { valid: true, newNodesByOldPlaceholderNodes, insertionPathRanges };
}
