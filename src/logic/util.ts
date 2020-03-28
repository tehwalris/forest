export function unreachable(v: never): never {
  console.error(v);
  throw new Error("unreachable");
}
