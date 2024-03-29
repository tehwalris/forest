export function unreachable(v: never): never {
  console.error(v);
  throw new Error("unreachable");
}
export function mergeIntoMapNoDuplicates<K, V>(
  target: Map<K, V>,
  source: Map<K, V>,
) {
  for (const [k, v] of source.entries()) {
    if (target.has(k)) {
      throw new Error(`duplicate key during merge (${k})`);
    }
    target.set(k, v);
  }
}
export function mergeIntoMapNoOverwrite<K, V>(
  target: Map<K, V>,
  source: Map<K, V>,
) {
  for (const [k, v] of source.entries()) {
    target.set(k, v);
  }
}
export function sliceTail<T>(a: T[], n: number): T[] {
  if (n < 0) {
    throw new Error("negative count");
  }
  if (n === 0) {
    return [];
  }
  return a.slice(-n);
}
export function isSubarray(long: unknown[], short: unknown[]): boolean {
  if (long.length < short.length) {
    return false;
  }
  const remainingShort = [...short];
  for (const v of long) {
    if (!remainingShort.length) {
      return true;
    }
    if (remainingShort[0] === v) {
      remainingShort.shift();
    }
  }
  return !remainingShort.length;
}
export function assertSortedBy<T>(values: T[], cb: (v: T) => number): void {
  let last = undefined;
  for (const v of values) {
    const cur = cb(v);
    if (last === undefined || last <= cur) {
      last = cur;
    } else {
      throw new Error("not sorted");
    }
  }
}
export function checkAllItemsDefined<T>(
  values: (T | undefined)[],
): values is T[] {
  return values.every((v) => v !== undefined);
}
export function groupBy<K, V>(
  values: V[],
  cb: (v: V, i: number) => K,
): Map<K, V[]> {
  const result = new Map<K, V[]>();
  for (const [i, v] of values.entries()) {
    const k = cb(v, i);
    const group = result.get(k) || [];
    result.set(k, group);
    group.push(v);
  }
  return result;
}
