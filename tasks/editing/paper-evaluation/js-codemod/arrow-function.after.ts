"use strict";
var fn1 = () => console.log("Banana!");
var fn2 = function () {
  console.log("Banana banana!");
}.bind(this, 1, 2, 3);
var fn3 = (a, b, c) => {
  console.log("foo!");
  console.log(a, b, c);
};
var fn4 = () => console.log("foo!");
var fn5 = function named() {
  console.log("don't transform me!");
}.bind(this);
var fn6 = () => ({ a: 1 });
var fn7 = () => {
  console.log("Keep");
  console.log("comments");
};
[1, 2, 3].map((x) => x * x);
[1, 2, 3].map((x) => x * x);
compare(1, 2, (num1, num2) => num1 > num2);
compare(1, 2, (num1, num2) => num1 > num2);
Promise.resolve()
  .then(
    function () {
      console.log("foo");
    }.bind(this, "a"),
  )
  .then((a) => 4);
foo(() => console.log("Keep comments when inlining single expressions"));
foo(function (a) {
  this.bar(function () {
    return a + this.b;
  });
});
foo(function (a) {
  bar(function () {
    return a + this.b;
  });
});
foo(function (a) {
  bar(() => a + this.b);
});
foo(function bar() {
  console.log("foo");
});
foo(function baz_prototype() {
  console.log("foo");
});
baz_prototype.prototype = {};
var generatorFunc = function* () {
  console.log("I shall not be transformed!");
}.bind(this);
foo(function* () {
  console.log("I shall not be transformed!");
});
