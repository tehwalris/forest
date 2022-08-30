const fs = require("fs");
const path = require("path");
const assert = require("assert");

const mapFromJson = (filename) =>
  new Map(JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf8")));

const invertMap = (m) => new Map([...m.entries()].map(([k, v]) => [v, k]));

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

module.exports = {
  mapFromJson,
  invertMap,
  appendAtDepth,
  notesToGroupedLines,
};
