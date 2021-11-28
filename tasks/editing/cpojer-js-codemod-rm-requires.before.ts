var merge = require("merge");
var dupMerge = require("merge");
var nonUsedModule = require("nonUsedModule");

var { export1, export2 } = require("nonUsedModule2");

require("sideEffectModule");

var x = merge(a);
var a = dupMerge(x);

window.nonUsedModule;

dupMerge;

function newScope() {
  var dupMerge2 = require("merge");
  var nonUsedModule2 = require("nonUsedModule2");

  dupMerge2;
}
