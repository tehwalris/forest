import {
  EvenPathRange,
  NodeWithPath,
  Path,
  UnevenPathRange,
} from "./interfaces";

export function pathsAreEqual(a: Path, b: Path): boolean {
  return a === b || (a.length === b.length && a.every((v, i) => v === b[i]));
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

export function evenPathRangesAreEqual(
  a: EvenPathRange,
  b: EvenPathRange,
): boolean {
  return (
    a === b || (pathsAreEqual(a.anchor, b.anchor) && a.offset === b.offset)
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
