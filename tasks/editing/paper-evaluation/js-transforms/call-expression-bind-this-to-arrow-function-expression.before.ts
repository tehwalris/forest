onClick(
  function (a, b) {
    return a + b;
  }.bind(this),
  function (b, c) {
    return 1;
  }.bind(this),
);

onClick(
  function (a) {
    var a = 1;
    return a;
  }.bind(this),
);

var a = function (c) {
  return c;
}.bind(this);
