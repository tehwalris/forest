const one = 1;
const two = 2;
const four = 4;

const myFunc = function() { };

const myObj = {
  one,
  two,
  three: one,
  four,
  myFunc,
  ['computed' + 'property']: 1,
  method() { },
  method2: () => { },
  method3: function foo(n) {
    if (n === 0) {
      return n;
    }
    return foo(n - 1) + n;
  },
  method4() {
    return one;
  },
};
