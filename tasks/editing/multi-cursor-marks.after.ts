export function f(
  thing: string = "test",
  count: number = 1,
  debug: boolean = false,
) {
  if (debug) {
    console.log({
      thing: { current: thing, default: "test" },
      count: { current: count, default: 1 },
    });
  }
  return count === 1 ? thing : thing + "s";
}
