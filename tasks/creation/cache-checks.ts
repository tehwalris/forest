// src/logic/tree/display-line.ts

var cache: any;
var key: any;
var mode: any;
var currentPos: any;
var indentStack: any;

export function tryGetCacheEntry() {
  const entry = cache.get(key);
  if (
    entry &&
    entry.state.mode === mode &&
    entry.state.currentPos === currentPos &&
    entry.state.indentStack.length === indentStack.length &&
    entry.state.indentStack.every((v, i) => v === indentStack[i])
  ) {
    return entry;
  }
}
