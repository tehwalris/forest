import { isFocusOnEmptyListContent } from "./focus";
import { EvenPathRange, ListNode, Node, NodeKind, Path } from "./interfaces";
import { makePlaceholderIdentifier } from "./make-valid";
import {
  evenPathRangeIsValid,
  flipEvenPathRangeForward,
  getCommonPathPrefix,
  pathsAreEqual,
} from "./path-utils";
import { nodeMapDeep } from "./tree-utils/access";
export interface ListItemReplacement {
  range: EvenPathRange;
  structKeys?: string[];
  content: Node[];
}
interface EmptyPathRange {
  before: Path;
}
type NewRange =
  | { empty: false; range: EvenPathRange }
  | { empty: true; range: EmptyPathRange }
  | undefined;
interface MultiReplaceArgs {
  root: ListNode;
  replacements: ListItemReplacement[];
}
interface MultiReplaceResult {
  root: ListNode;
  replacementWasUsed: boolean[];
  newContentRanges: NewRange[];
  ambiguousOverlap: boolean;
}
function shiftNewRange(
  range: NewRange,
  offsetIndex: number,
  offsetAmount: number,
): NewRange {
  if (offsetAmount === 0) {
    return range;
  }
  if (range === undefined) {
    return undefined;
  } else if (range.empty) {
    if (!range.range.before.length) {
      throw new Error("unshiftable EmptyPathRange");
    }
    const newBefore = [...range.range.before];
    newBefore[offsetIndex] += offsetAmount;
    return { empty: true, range: { before: newBefore } };
  } else {
    if (!range.range.anchor.length) {
      throw new Error("unshiftable EvenPathRange");
    }
    const newAnchor = [...range.range.anchor];
    newAnchor[offsetIndex] += offsetAmount;
    return {
      empty: false,
      range: { anchor: newAnchor, offset: range.range.offset },
    };
  }
}
export function checkAllItemsAreEvenPathRange(
  values: (NewRange | undefined)[],
): values is { empty: false; range: EvenPathRange }[] {
  return values.every((v) => v && !v.empty);
}
export function replaceMultiple({
  root: oldRoot,
  replacements,
}: MultiReplaceArgs): MultiReplaceResult {
  replacements = replacements.map((r) => ({
    ...r,
    range: flipEvenPathRangeForward(r.range),
  }));
  if (
    !replacements.every(
      (r) =>
        r.range.anchor.length &&
        (evenPathRangeIsValid(oldRoot, r.range) ||
          isFocusOnEmptyListContent(oldRoot, r.range)) &&
        (r.structKeys === undefined ||
          r.structKeys.length === r.content.length),
    )
  ) {
    throw new Error("some replacements are invalid");
  }
  const emptyListPaths = replacements
    .filter((r) => isFocusOnEmptyListContent(oldRoot, r.range))
    .map((r) => r.range.anchor.slice(0, -1));
  const oldRootWithEmptyListPlaceholders = nodeMapDeep(
    oldRoot,
    (oldNode, path): Node => {
      if (!emptyListPaths.find((p) => pathsAreEqual(p, path))) {
        return oldNode;
      }
      if (oldNode.kind !== NodeKind.List || oldNode.content.length) {
        throw new Error("invalid emptyListPaths");
      }
      return { ...oldNode, content: [makePlaceholderIdentifier()] };
    },
  );
  const usedReplacements = new Set<ListItemReplacement>();
  const newContentRanges = new Map<ListItemReplacement, NewRange>();
  let ambiguousOverlap = false;
  const newRoot = nodeMapDeep(
    oldRootWithEmptyListPlaceholders,
    (oldNode, path): Node => {
      if (oldNode.kind !== NodeKind.List) {
        return oldNode;
      }
      const replacementsThisList = replacements.filter((r) =>
        pathsAreEqual(r.range.anchor.slice(0, -1), path),
      );
      if (!replacementsThisList.length) {
        return oldNode;
      }
      const possibleSourceIndices: number[][] = oldNode.content.map(() => []);
      for (const [i, r] of replacementsThisList.entries()) {
        const first = r.range.anchor[r.range.anchor.length - 1];
        const last = first + r.range.offset;
        for (let j = first; j <= last; j++) {
          possibleSourceIndices[j].push(i);
        }
      }
      ambiguousOverlap =
        ambiguousOverlap ||
        possibleSourceIndices.some((indices) => indices.length > 1);
      const chosenSourceIndices: (number | undefined)[] = [];
      {
        let cur: number | undefined;
        for (const indices of possibleSourceIndices) {
          if (cur === undefined || !indices.includes(cur)) {
            cur = indices[0];
          }
          chosenSourceIndices.push(cur);
        }
      }
      const replacementsInReplacedChild: ListItemReplacement[] = [];
      const replacementsInShiftedChild: ListItemReplacement[][] =
        chosenSourceIndices.map(() => []);
      for (const r of usedReplacements) {
        if (!pathsAreEqual(getCommonPathPrefix(r.range.anchor, path), path)) {
          continue;
        }
        const childIndex: number | undefined = r.range.anchor[path.length];
        if (childIndex === undefined) {
          throw new Error("unreachable");
        }
        if (chosenSourceIndices[childIndex] === undefined) {
          replacementsInShiftedChild[childIndex].push(r);
        } else {
          replacementsInReplacedChild.push(r);
        }
      }
      for (const r of replacementsInReplacedChild) {
        usedReplacements.delete(r);
        newContentRanges.delete(r);
      }
      const newContent: Node[] = [];
      const newStructKeys: string[] | undefined = oldNode.structKeys && [];
      for (const [i, j] of chosenSourceIndices.entries()) {
        for (const shiftedReplacement of replacementsInShiftedChild[i]) {
          const oldRange = newContentRanges.get(shiftedReplacement);
          if (!oldRange) {
            continue;
          }
          if (
            !pathsAreEqual(
              getCommonPathPrefix(
                oldRange.empty ? oldRange.range.before : oldRange.range.anchor,
                path,
              ),
              path,
            )
          ) {
            throw new Error("shiftedReplacement is not valid");
          }
          newContentRanges.set(
            shiftedReplacement,
            shiftNewRange(oldRange, path.length, newContent.length - i),
          );
        }
        const r = j === undefined ? undefined : replacementsThisList[j];
        if (!r) {
          newContent.push(oldNode.content[i]);
          if (newStructKeys) {
            newStructKeys.push(oldNode.structKeys![i]);
          }
        } else if (r && !usedReplacements.has(r)) {
          usedReplacements.add(r);
          if (r.content.length) {
            newContentRanges.set(r, {
              empty: false,
              range: {
                anchor: [...path, newContent.length],
                offset: r.content.length - 1,
              },
            });
          } else {
            newContentRanges.set(r, {
              empty: true,
              range: {
                before: [...path, newContent.length],
              },
            });
          }
          newContent.push(...r.content);
          if (!newStructKeys !== !r.structKeys) {
            throw new Error(
              "replacement and target node must either both have or not have struct keys",
            );
          }
          if (newStructKeys) {
            newStructKeys.push(...r.structKeys!);
          }
        }
      }
      return { ...oldNode, content: newContent, structKeys: newStructKeys };
    },
  );
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("unreachable");
  }
  return {
    root: newRoot,
    replacementWasUsed: replacements.map((r) => usedReplacements.has(r)),
    newContentRanges: replacements.map((r) => newContentRanges.get(r)),
    ambiguousOverlap,
  };
}
