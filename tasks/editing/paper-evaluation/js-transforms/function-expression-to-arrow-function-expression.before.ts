var a = function (a, b) {
  return a + b;
};
var b = function (a, b) {
  var c = 0;
  return a + b + c;
};
var a = function (a, b) {
  return a + b + this.c;
};
