var merge = require("merge");

var { export1, export2 } = require("nonUsedModule2");

require("sideEffectModule");

var x = merge(a);
var a = merge(x);

window.nonUsedModule;

merge;

function newScope() {
  var dupMerge2 = require("merge");

  dupMerge2;
}
