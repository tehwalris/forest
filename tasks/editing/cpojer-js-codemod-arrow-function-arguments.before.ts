'use strict';

var fn1 = () => console.log(arguments);

var fn2 = (a, b, c) => {
  console.log(arguments);

  return arguments;
};

var fn3 = (a, b, args) => {
  console.log(args);

  return arguments;
};

var fn4 = function(a, b, c) {
  console.log(arguments);
  var fn5 = () => arguments;
  var fn6 = () => (function() { return arguments; });
  class A {
    constructor() {
      console.log(arguments);
    }
  }
};

var fn5 = (a, ...b) => arguments;

var fn7 = (ref) => console.log(ref.arguments);
