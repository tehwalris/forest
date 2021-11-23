'use strict';

var fn1 = (...args) => console.log(args);

var fn2 = (a, b, c, ...args) => {
  console.log([a, b, c, ...args]);

  return [a, b, c, ...args];
};

var fn3 = (a, b, args) => {
  console.log(args);

  return arguments;
};

var fn4 = function(a, b, c) {
  console.log(arguments);
  var fn5 = (...args) => args;
  var fn6 = () => (function() { return arguments; });
  class A {
    constructor() {
      console.log(arguments);
    }
  }
};

var fn5 = (a, ...b) => [a, ...b];

var fn7 = (ref) => console.log(ref.arguments);
