import { EvenPathRange, ListNode, Path } from "./interfaces";
import { getSmallestContainingRange, pathIsInRange } from "./path-utils";
import { nodeVisitDeep } from "./tree-utils/access";
export function trackRanges(
  oldRoot: ListNode,
  newRoot: ListNode,
  oldRanges: EvenPathRange[],
): (EvenPathRange | undefined)[] {
  const rangeIndicesByNodeIds = new Map<Symbol, number[]>();
  nodeVisitDeep(oldRoot, (oldNode, path) => {
    for (const [iRange, range] of oldRanges.entries()) {
      if (!pathIsInRange(path, range)) {
        continue;
      }
      const rangeIndices = rangeIndicesByNodeIds.get(oldNode.id) || [];
      rangeIndicesByNodeIds.set(oldNode.id, rangeIndices);
      rangeIndices.push(iRange);
    }
  });
  const pathsByRange: Path[][] = oldRanges.map(() => []);
  nodeVisitDeep(newRoot, (newNode, path) => {
    const rangeIndices = rangeIndicesByNodeIds.get(newNode.id) || [];
    for (const iRange of rangeIndices) {
      pathsByRange[iRange].push(path);
    }
  });
  return pathsByRange.map((paths) =>
    paths.length ? getSmallestContainingRange(paths) : undefined,
  );
}
