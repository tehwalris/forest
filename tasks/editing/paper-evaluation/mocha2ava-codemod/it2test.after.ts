"use strict";

const foo = require("bar");

test.before(function () {
  foo("before each");
  this.bar = foo;
});

test("bare it", () => {
  foo();
});

describe("root", function () {
  test.beforeEach(function () {
    foo("before each");
    this.bar = foo;
  });

  describe("describe under root", function () {
    test("it under an describe", function () {
      foo("it under an describe");
    });
  });

  test("it under root", function () {
    foo("it under root");
  });

  test("it with context", function () {
    this.foo = foo;
    this.foo(this.bar);
  });

  test("it with generator", function* () {
    yield foo("it with generator");
    yield* foo("yield with delegation");

    const bar = yield foo("yield in assignment");

    return foo();
  });

  test("it with async", async () => {
    await foo("it with await");
    const bar = await foo("await in assignment");
    return foo();
  });
});
