import { last, sortBy } from "ramda";
import { EvenPathRange, Path } from "./interfaces";
import { PathTree } from "./path-tree";
import {
  getCommonPathPrefix,
  pathIsInRange,
  pathsAreEqual,
} from "./path-utils";
import { groupBy } from "./util";

function getParent(range: EvenPathRange): Path {
  if (!range.anchor.length) {
    throw new Error("root path range has no parent");
  }
  return range.anchor.slice(0, -1);
}

function addFakeRoot(r: EvenPathRange) {
  return {
    anchor: [-1, ...r.anchor],
    offset: r.offset,
  };
}

function removeFakeRoot(r: EvenPathRange) {
  if (!r.anchor.length || r.anchor[0] !== -1) {
    throw new Error("range does not have fake root");
  }
  return { anchor: r.anchor.slice(1), offset: r.offset };
}

function groupOverlappingRangesOnSameLevel(
  ranges: EvenPathRange[],
): EvenPathRange[][] {
  if (!ranges.length) {
    return [];
  }
  if (!ranges[0].anchor.length) {
    throw new Error("invalid prefix");
  }
  const prefix = ranges[0].anchor.slice(0, -1);
  if (
    !ranges.every((r) =>
      pathsAreEqual(getCommonPathPrefix(r.anchor, prefix), prefix),
    )
  ) {
    throw new Error("not all ranges have the same prefix");
  }
  if (ranges.some((r) => r.offset < 0)) {
    throw new Error("backwards path ranges are not allowed");
  }
  const getStart = (r: EvenPathRange) => last(r.anchor)!;
  const getEnd = (r: EvenPathRange) => getStart(r) + r.offset;
  let current: { ranges: EvenPathRange[]; end: number } | undefined;
  const output: EvenPathRange[][] = [];
  for (const r of sortBy(getStart, ranges)) {
    if (!current || getStart(r) > current.end) {
      current = { ranges: [], end: 0 };
      output.push(current.ranges);
    }
    current.ranges.push(r);
    current.end = Math.max(current.end, getEnd(r));
  }
  return output;
}

export function groupOverlappingNonNestedRanges(
  _ranges: EvenPathRange[],
): number[][] {
  if (_ranges.some((r) => r.offset < 0)) {
    throw new Error("backwards path ranges are not allowed");
  }
  const ranges = _ranges.map((r) => addFakeRoot(r));
  const indicesByRange = new Map<EvenPathRange, number>(
    ranges.map((r, i) => [r, i]),
  );
  const groupTree = new PathTree();
  const leavesByRange = ranges.map((r) => groupTree.insert(getParent(r)));
  const parentGroups = [
    ...groupBy(ranges, (_r, i) => leavesByRange[i]).values(),
  ];
  const output: number[][] = [];
  for (const parentGroup of parentGroups) {
    output.push(
      ...groupOverlappingRangesOnSameLevel(parentGroup).map((overlapGroup) =>
        overlapGroup.map((r) => indicesByRange.get(r)!),
      ),
    );
  }
  return output;
}

export function hasOverlappingNonNestedRanges(
  ranges: EvenPathRange[],
): boolean {
  return groupOverlappingNonNestedRanges(ranges).some((g) => g.length > 1);
}

export class PathRangeTree {
  private rootRange: EvenPathRange = { anchor: [], offset: 0 };
  private rangesByParentRange: Map<EvenPathRange, EvenPathRange[]>;

  constructor(_ranges: EvenPathRange[]) {
    if (hasOverlappingNonNestedRanges(_ranges)) {
      throw new Error("overlapping non-nested ranges are not allowed");
    }
    if (_ranges.some((r) => r.offset < 0)) {
      throw new Error("backwards path ranges are not allowed");
    }
    const ranges = _ranges.map((r) => addFakeRoot(r));
    this.rangesByParentRange = PathRangeTree.build(ranges, this.rootRange);
  }

  private static build(
    ranges: EvenPathRange[],
    rootRange: EvenPathRange,
  ): Map<EvenPathRange, EvenPathRange[]> {
    const groupTree = new PathTree();
    const leavesByRange = ranges.map((r) => groupTree.insert(getParent(r)));
    const groupsByLeaf = groupBy(ranges, (_r, i) => leavesByRange[i]);
    const getGroupByLeaf = (leaf: Symbol) => {
      const pathRanges = groupsByLeaf.get(leaf);
      if (!pathRanges) {
        throw new Error("invalid leaf");
      }
      return pathRanges;
    };
    const parentRangesByRange = new Map<EvenPathRange, EvenPathRange>();
    const openLeaves: Symbol[] = [];
    groupTree.traverse(
      (groupPath, childLeaf) => {
        openLeaves.push(childLeaf);
        for (const parentLeaf of openLeaves.slice(0, -1)) {
          for (const parentRange of getGroupByLeaf(parentLeaf)) {
            if (pathIsInRange(groupPath, parentRange)) {
              for (const childRange of getGroupByLeaf(childLeaf)) {
                parentRangesByRange.set(childRange, parentRange);
              }
              return;
            }
          }
        }
        for (const childRange of getGroupByLeaf(childLeaf)) {
          parentRangesByRange.set(childRange, rootRange);
        }
      },
      () => {
        if (!openLeaves.length) {
          throw new Error("underflow");
        }
        openLeaves.pop();
      },
    );
    const rangesByParentRange = groupBy(
      ranges,
      (r) => parentRangesByRange.get(r)!,
    );
    for (const group of rangesByParentRange.values()) {
      group.sort((a, b) => last(a.anchor)! - last(b.anchor)!);
    }
    return rangesByParentRange;
  }

  traverse(onEnter: (range: EvenPathRange) => void, onExit: () => void) {
    const queue: (EvenPathRange | undefined)[] = [
      ...(this.rangesByParentRange.get(this.rootRange) || []),
    ];
    while (queue.length) {
      const range = queue.shift();
      if (range) {
        onEnter(removeFakeRoot(range));
        queue.unshift(
          ...(this.rangesByParentRange.get(range) || []),
          undefined,
        );
      } else {
        onExit();
      }
    }
  }
}
