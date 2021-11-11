import { EvenPathRange, ListNode, Node, NodeKind } from "./interfaces";
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

interface MultiReplaceArgs {
  root: ListNode;
  replacements: ListItemReplacement[];
}

interface MultiReplaceResult {
  root: ListNode;
  replacementWasUsed: boolean[];
  ambiguousOverlap: boolean;
}

export function replaceMultiple({
  root: oldRoot,
  replacements,
}: MultiReplaceArgs): MultiReplaceResult {
  // HACK It's important that this makes every replacement reference-unique,
  // since they are tracked by reference later.
  replacements = replacements.map((r) => ({
    ...r,
    range: flipEvenPathRangeForward(r.range),
  }));

  if (
    !replacements.every(
      (r) =>
        r.range.anchor.length &&
        evenPathRangeIsValid(oldRoot, r.range) &&
        (r.structKeys === undefined ||
          r.structKeys.length === r.content.length),
    )
  ) {
    throw new Error("some replacements are invalid");
  }

  const usedReplacements = new Set<ListItemReplacement>();
  let ambiguousOverlap = false;
  const newRoot = nodeMapDeep(oldRoot, (oldNode, path): Node => {
    if (oldNode.kind !== NodeKind.List) {
      return oldNode;
    }

    const replacementsThisList = replacements.filter((r) =>
      pathsAreEqual(r.range.anchor.slice(0, -1), path),
    );
    if (!replacementsThisList) {
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
      // If possible, assign the same source as the last item had, otherwise we
      // might split ranges, which would break replacement.
      let cur: number | undefined;
      for (const indices of possibleSourceIndices) {
        if (cur === undefined || !indices.includes(cur)) {
          cur = indices[0];
        }
        chosenSourceIndices.push(cur);
      }
    }

    const replacementsInReplacedChild: ListItemReplacement[] = [];
    for (const r of usedReplacements) {
      if (!pathsAreEqual(getCommonPathPrefix(r.range.anchor, path), path)) {
        // not in this subtree at all
        continue;
      }
      const childIndex: number | undefined = r.range.anchor[path.length];
      if (childIndex === undefined) {
        throw new Error("unreachable");
      }
      if (chosenSourceIndices[childIndex] !== undefined) {
        replacementsInReplacedChild.push(r);
      }
    }
    for (const r of replacementsInReplacedChild) {
      usedReplacements.delete(r);
    }

    const newContent: Node[] = [];
    const newStructKeys: string[] | undefined = oldNode.structKeys && [];
    for (const [i, j] of chosenSourceIndices.entries()) {
      const r = j === undefined ? undefined : replacementsThisList[j];
      if (!r) {
        newContent.push(oldNode.content[i]);
        if (newStructKeys) {
          newStructKeys.push(oldNode.structKeys![i]);
        }
      } else if (r && !usedReplacements.has(r)) {
        usedReplacements.add(r);
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
  });
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("unreachable");
  }

  return {
    root: newRoot,
    replacementWasUsed: replacements.map((r) => usedReplacements.has(r)),
    ambiguousOverlap,
  };
}
