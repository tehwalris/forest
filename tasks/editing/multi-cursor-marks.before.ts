export function f(thing: string = "test", count: number = 1) {
  return count === 1 ? thing : thing + "s";
}
