import { ListNode, NodeWithPath, Path } from "./interfaces";
import { PathMapper } from "./path-mapper";
import {
  flattenNodeAroundSplit,
  splitAtDeepestDelimiter,
} from "./tree-utils/flatten";
import { nodesAreEqualExceptRangesAndPlaceholders } from "./tree-utils/equal";
import { pathsAreEqual } from "./path-utils";
import { sliceTail } from "./util";

export type CheckedInsertion =
  | {
      valid: false;
    }
  | {
      valid: true;
      pathMapper: PathMapper;
    };

export function checkInsertion(
  nodeOld: ListNode,
  nodeNew: ListNode,
  insertBeforePath: Path,
): CheckedInsertion {
  const printReason = (reason: string) => {
    console.warn(`Insertion is not valid. Reason: ${reason}`);
  };

  if (!insertBeforePath.length) {
    throw new Error("insertBeforePath must not be empty");
  }

  const delimiterSplitOld = splitAtDeepestDelimiter(nodeOld, insertBeforePath);
  const delimiterSplitNew = splitAtDeepestDelimiter(nodeNew, insertBeforePath);
  if (
    !nodesAreEqualExceptRangesAndPlaceholders(
      delimiterSplitOld.withEmptyList,
      delimiterSplitNew.withEmptyList,
    )
  ) {
    printReason("changes outside of nearest containing delimited list");
    return { valid: false };
  }

  if (
    !pathsAreEqual(delimiterSplitOld.pathToList, delimiterSplitNew.pathToList)
  ) {
    printReason("path to nearest containing delimited list has changed");
    return { valid: false };
  }

  const flatOld = flattenNodeAroundSplit(
    delimiterSplitOld.list,
    delimiterSplitOld.pathFromList,
  );
  const flatNew = flattenNodeAroundSplit(
    delimiterSplitNew.list,
    delimiterSplitNew.pathFromList,
  );
  if (
    flatOld.before.length > flatNew.before.length ||
    flatOld.after.length > flatNew.after.length
  ) {
    printReason("new flat lists are shorter");
    return { valid: false };
  }

  const allNodesAreEqualWithoutPaths = (
    nodesA: NodeWithPath[],
    nodesB: NodeWithPath[],
  ): boolean =>
    nodesA.every((a, i) =>
      nodesAreEqualExceptRangesAndPlaceholders(a.node, nodesB[i].node),
    );
  const flatNewBeforeCommon = flatNew.before.slice(0, flatOld.before.length);
  if (!allNodesAreEqualWithoutPaths(flatOld.before, flatNewBeforeCommon)) {
    printReason("existing nodes before cursor changed");
    return { valid: false };
  }
  const flatNewAfterCommon = sliceTail(flatNew.after, flatOld.after.length);
  if (!allNodesAreEqualWithoutPaths(flatOld.after, flatNewAfterCommon)) {
    printReason("existing nodes after cursor changed");
    return { valid: false };
  }

  const pathMapper = new PathMapper(delimiterSplitOld.pathToList);
  for (const [i, oldEntry] of flatOld.before.entries()) {
    pathMapper.record({ old: oldEntry.path, new: flatNewBeforeCommon[i].path });
  }
  for (const [i, oldEntry] of flatOld.after.entries()) {
    pathMapper.record({ old: oldEntry.path, new: flatNewAfterCommon[i].path });
  }

  return { valid: true, pathMapper };
}
