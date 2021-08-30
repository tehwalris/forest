declare namespace ts {
  type Statement = any;
}

type Union<T> = any;
type LazyUnionVariant<T> = any;

interface MergedUnionCacheEntry {
  union: Union<ts.Statement>;
  variants: LazyUnionVariant<string>[];
}

const mergedUnionCache = new WeakMap<
  Union<ts.Statement>,
  MergedUnionCacheEntry
>();

export function makeMergedUnion(
  statementUnion: Union<ts.Statement>,
): MergedUnionCacheEntry {
  const oldCacheEntry = mergedUnionCache.get(statementUnion);
  if (oldCacheEntry) {
    return oldCacheEntry;
  }
  const newCacheEntry = _makeMergedUnion(statementUnion);
  mergedUnionCache.set(statementUnion, newCacheEntry);
  return newCacheEntry;
}

function _makeMergedUnion(
  statementUnion: Union<ts.Statement>,
): MergedUnionCacheEntry {
  return { union: {}, variants: [] };
}
