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
