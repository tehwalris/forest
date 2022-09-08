const foo = require("foo");
test("should add a pass test statement", (t) => {
  foo();
});
test("should add a pass test statement", (t) => {
  foo();
  t.context.foo();
});
test(
  "should also work on co wrapped impl",
  co.wrap(function* (t) {
    foo();
  }),
);
test("should not add a pass test statement if t is used", (t) => {
  foo();
  t.fail();
});
test("should not add a pass test statement if t is used", (t) => {
  foo();
  t.throws();
});
