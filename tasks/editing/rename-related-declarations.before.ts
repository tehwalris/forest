declare namespace ts {
  type Statement = any;
}

type Union<T> = any;
type LazyUnionVariant<T> = any;

interface ExpressionOrStatementCacheEntry {
  union: Union<ts.Statement>;
  variants: LazyUnionVariant<string>[];
}

const expressionOrStatementCache = new WeakMap<
  Union<ts.Statement>,
  ExpressionOrStatementCacheEntry
>();

export function makeExpressionOrStatement(
  statementUnion: Union<ts.Statement>,
): ExpressionOrStatementCacheEntry {
  const oldCacheEntry = expressionOrStatementCache.get(statementUnion);
  if (oldCacheEntry) {
    return oldCacheEntry;
  }
  const newCacheEntry = _makeExpressionOrStatement(statementUnion);
  expressionOrStatementCache.set(statementUnion, newCacheEntry);
  return newCacheEntry;
}

function _makeExpressionOrStatement(
  statementUnion: Union<ts.Statement>,
): ExpressionOrStatementCacheEntry {
  return { union: {}, variants: [] };
}
