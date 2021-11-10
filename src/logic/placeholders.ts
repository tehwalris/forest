import ts from "typescript";
import { Doc, ListNode, Node, NodeKind, Path, TextRange } from "./interfaces";
import { makeNodeValidTs } from "./make-valid";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import { PathMapper } from "./path-mapper";
import { prettyPrintTsSourceFile } from "./print";
import {
  duplicateMapPosCb,
  getTextWithDeletions,
  mapNodeTextRanges,
} from "./text";
import { nodeVisitDeep } from "./tree-utils/access";
import { nodesAreEqualExceptRangesAndPlaceholders } from "./tree-utils/equal";
import { filterNodes } from "./tree-utils/filter";
import { tsNodeFromNode } from "./ts-from-node";

export function withCopiedPlaceholders(
  placeholderSource: ListNode,
  nodeSource: ListNode,
): ListNode;
export function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node;
export function withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    !nodesAreEqualExceptRangesAndPlaceholders(placeholderSource, nodeSource)
  ) {
    throw new Error(
      "nodes do not satisfy nodesAreEqualExceptRangesAndPlaceholders",
    );
  }
  return _withCopiedPlaceholders(placeholderSource, nodeSource);
}

function _withCopiedPlaceholders(
  placeholderSource: Node,
  nodeSource: Node,
): Node {
  if (
    placeholderSource.kind === NodeKind.Token &&
    nodeSource.kind === NodeKind.Token
  ) {
    return { ...nodeSource, isPlaceholder: placeholderSource.isPlaceholder };
  }
  if (
    placeholderSource.kind === NodeKind.List &&
    nodeSource.kind === NodeKind.List
  ) {
    return {
      ...nodeSource,
      isPlaceholder: placeholderSource.isPlaceholder,
      content: placeholderSource.content.map((placeholderSourceChild, i) =>
        _withCopiedPlaceholders(placeholderSourceChild, nodeSource.content[i]),
      ),
    };
  }
  throw new Error("unreachable");
}

export function getDocWithAllPlaceholders(docWithoutPlaceholders: Doc): {
  doc: Doc;
  pathMapper: PathMapper;
} {
  const placeholderAddition = makeNodeValidTs(docWithoutPlaceholders.root);
  const validRoot = placeholderAddition.node;
  const sourceFile = tsNodeFromNode(validRoot) as ts.SourceFile;
  const text = prettyPrintTsSourceFile(sourceFile);
  const parsedDoc = docFromAst(astFromTypescriptFileContent(text));
  if (!nodesAreEqualExceptRangesAndPlaceholders(validRoot, parsedDoc.root)) {
    console.warn("update would change tree");
    console.warn("old", docWithoutPlaceholders.text, validRoot);
    console.warn("new", text, parsedDoc.root);
    throw new Error("update would change tree");
  }
  const docWithPlaceholders = {
    root: withCopiedPlaceholders(validRoot, parsedDoc.root),
    text: parsedDoc.text,
  };
  return {
    doc: docWithPlaceholders,
    pathMapper: placeholderAddition.pathMapper,
  };
}

export function getDocWithoutPlaceholdersNearCursors(
  doc: Doc,
  cursorBeforePositions: number[],
): {
  doc: Doc;
  mapOldToWithoutAdjacent: (path: Path) => Path;
  cursorBeforePositions: number[];
} {
  const cursorWhitespaceRanges: TextRange[] = cursorBeforePositions.map(
    (cursorBeforePos) => {
      return {
        pos: ((pos: number) => {
          while (
            pos > 0 &&
            pos < doc.text.length &&
            doc.text[pos - 1].match(/\s/)
          ) {
            pos--;
          }
          return pos;
        })(cursorBeforePos),
        end: ((end: number) => {
          while (
            end >= 0 &&
            end + 1 < doc.text.length &&
            doc.text[end].match(/\s/)
          ) {
            end++;
          }
          return end;
        })(cursorBeforePos),
      };
    },
  );

  const isAdjacentToCursor = (range: TextRange) =>
    cursorWhitespaceRanges.some(
      ({ pos, end }) =>
        (range.pos >= pos && range.pos <= end) ||
        (range.end >= pos && range.end <= end),
    );

  const shouldKeepNode = (node: Node) =>
    !node.isPlaceholder || !isAdjacentToCursor(node);
  const placeholderRemoval = filterNodes(doc.root, shouldKeepNode);
  const removedPlaceholders: Node[] = [];
  nodeVisitDeep(doc.root, (node) => {
    if (!shouldKeepNode(node)) {
      removedPlaceholders.push(node);
    }
  });

  const textDeletion = getTextWithDeletions(doc.text, removedPlaceholders);

  const mapOldToWithoutAdjacent = (oldPath: Path) =>
    placeholderRemoval.pathMapper.mapRough(oldPath);

  return {
    doc: {
      root: mapNodeTextRanges(
        placeholderRemoval.node,
        duplicateMapPosCb(textDeletion.mapPos),
      ),
      text: textDeletion.text,
    },
    mapOldToWithoutAdjacent,
    cursorBeforePositions: cursorBeforePositions.map((pos) =>
      textDeletion.mapPos(pos),
    ),
  };
}
