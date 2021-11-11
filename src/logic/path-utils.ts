import {
  EvenPathRange,
  NodeWithPath,
  Path,
  UnevenPathRange,
} from "./interfaces";

export function pathsAreEqual(a: Path, b: Path): boolean {
  return a === b || (a.length === b.length && a.every((v, i) => v === b[i]));
}

export function uniqueByPath<T>(items: T[], cb: (v: T) => Path): T[] {
  const seenPaths: Path[] = [];
  const uniqueItems: T[] = [];
  for (const v of uniqueItems) {
    const path = cb(v);
    if (seenPaths.find((seenPath) => pathsAreEqual(seenPath, path))) {
      continue;
    }
    seenPaths.push(path);
    uniqueItems.push(v);
  }
  return uniqueItems;
}

export function getCommonPathPrefix(a: Path, b: Path): Path {
  const common: Path = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      break;
    }
    common.push(a[i]);
  }
  return common;
}

export function getSmallestContainingRange(paths: Path[]): EvenPathRange {
  if (!paths.length) {
    throw new Error("no paths");
  }

  const commonPrefix = paths.reduce((a, c) => getCommonPathPrefix(a, c));

  if (paths.some((p) => pathsAreEqual(p, commonPrefix))) {
    return { anchor: commonPrefix, offset: 0 };
  }

  const indices = paths.map((p) => p[commonPrefix.length]);
  return {
    anchor: [...commonPrefix, Math.min(...indices)],
    offset: Math.max(...indices) - Math.min(...indices),
  };
}

export function evenPathRangesAreEqual(
  a: EvenPathRange,
  b: EvenPathRange,
): boolean {
  return (
    a === b || (pathsAreEqual(a.anchor, b.anchor) && a.offset === b.offset)
  );
}

export function evenPathRangesAreEqualIgnoringDirection(
  a: EvenPathRange,
  b: EvenPathRange,
): boolean {
  return evenPathRangesAreEqual(
    flipEvenPathRangeForward(a),
    flipEvenPathRangeForward(b),
  );
}

export function unevenPathRangesAreEqual(
  a: UnevenPathRange,
  b: UnevenPathRange,
): boolean {
  return (
    a === b ||
    (pathsAreEqual(a.anchor, b.anchor) && pathsAreEqual(a.tip, b.tip))
  );
}

export function prefixNodesWithPaths(
  nodes: NodeWithPath[],
  prefix: number,
): NodeWithPath[] {
  return nodes.map((r) => ({ ...r, path: [prefix, ...r.path] }));
}

export function asUnevenPathRange(even: EvenPathRange): UnevenPathRange {
  if (!even.offset) {
    return { anchor: even.anchor, tip: even.anchor };
  }
  if (!even.anchor.length) {
    throw new Error("offset at root is invalid");
  }
  const tip = [...even.anchor];
  tip[tip.length - 1] += even.offset;
  return { anchor: even.anchor, tip };
}

export function asEvenPathRange(uneven: UnevenPathRange): EvenPathRange {
  const commonPrefix = [];
  let firstUnequal: { anchor: number; tip: number } | undefined;
  for (let i = 0; i < Math.min(uneven.anchor.length, uneven.tip.length); i++) {
    if (uneven.anchor[i] === uneven.tip[i]) {
      commonPrefix.push(uneven.anchor[i]);
    } else {
      firstUnequal = { anchor: uneven.anchor[i], tip: uneven.tip[i] };
      break;
    }
  }
  return firstUnequal
    ? {
        anchor: [...commonPrefix, firstUnequal.anchor],
        offset: firstUnequal.tip - firstUnequal.anchor,
      }
    : { anchor: commonPrefix, offset: 0 };
}

export function flipEvenPathRange(oldPathRange: EvenPathRange): EvenPathRange {
  if (!oldPathRange.anchor.length || !oldPathRange.offset) {
    return oldPathRange;
  }
  const newPathRange = {
    anchor: [...oldPathRange.anchor],
    offset: -oldPathRange.offset,
  };
  newPathRange.anchor[newPathRange.anchor.length - 1] += oldPathRange.offset;
  return newPathRange;
}

export function flipUnevenPathRange({
  anchor,
  tip,
}: UnevenPathRange): UnevenPathRange {
  return { anchor: tip, tip: anchor };
}

export function flipEvenPathRangeForward(
  pathRange: EvenPathRange,
): EvenPathRange {
  return pathRange.offset >= 0 ? pathRange : flipEvenPathRange(pathRange);
}

export function flipEvenPathRangeBackward(
  pathRange: EvenPathRange,
): EvenPathRange {
  return flipEvenPathRange(flipEvenPathRangeForward(pathRange));
}

export function getPathToTip(pathRange: EvenPathRange): Path {
  const path = [...pathRange.anchor];
  if (!path.length) {
    return [];
  }
  path[path.length - 1] += pathRange.offset;
  return path;
}
