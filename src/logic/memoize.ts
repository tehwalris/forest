// first argument is used as a weak map key, further arguments are checked for reference equality
export function memoize<A extends [object, ...any], T>(
  f: (...args: A) => T,
): (...args: A) => T {
  const cache = new WeakMap<A[0], { args: unknown[]; result: T }>();
  return (...args: A): T => {
    if (!args.length) {
      return f(...args);
    }
    const entry = cache.get(args[0]);
    let result;
    if (
      entry &&
      entry.args.length + 1 === args.length &&
      args.slice(1).every((a, i) => a === entry.args[i])
    ) {
      result = entry.result;
    } else {
      result = f(...args);
      cache.set(args[0], { args: args.slice(1), result });
    }
    return result;
  };
}
