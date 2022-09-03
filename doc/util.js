const fs = require("fs");
const path = require("path");
const assert = require("assert");

function last(arr) {
  assert(Array.isArray(arr));
  assert(arr.length);
  return arr[arr.length - 1];
}

function appendAtDepth(tree, value, depth) {
  assert(Array.isArray(tree));
  assert(depth >= 0);
  if (depth === 0) {
    return tree.length ? [...tree, [value]] : [[value]];
  }
  if (!Array.isArray(last(tree))) {
    tree = [...tree, []];
  }
  const result = appendAtDepth(last(tree), value, depth - 1);
  return [...tree.slice(0, -1), result];
}

function notesToGroupedLines(notes) {
  let groupedLines = [];
  for (const line of notes.trim().split("\n")) {
    const m = line.match(/^(\s*)- (.*)$/);
    if (!m) {
      throw new Error(`Invalid line: ${line}`);
    }
    const indent = Math.floor(m[1].length / 2);
    groupedLines = appendAtDepth(groupedLines, m[2], indent);
  }
  return groupedLines;
}

function capitalizeFirst(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : "";
}

module.exports = {
  appendAtDepth,
  notesToGroupedLines,
  capitalizeFirst,
};
