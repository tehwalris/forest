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

const notesPath = path.join(__dirname, "interesting-commit-notes.md");

const notes = fs.readFileSync(notesPath, "utf-8");
let groupedLines = [];
for (const line of notes.trim().split("\n")) {
  const m = line.match(/^(\s*)- (.*)$/);
  if (!m) {
    throw new Error(`Invalid line: ${line}`);
  }
  const indent = Math.floor(m[1].length / 2);
  groupedLines = appendAtDepth(groupedLines, m[2], indent);
}

function tryAsNote(line) {
  if (typeof Array.isArray(line) && line.length === 1) {
    line = line[0];
  }
  if (typeof line !== "string") {
    return undefined;
  }
  const m = line.match(/^note: (.*)$/);
  if (!m) {
    return undefined;
  }
  return m[1];
}

function asNote(line) {
  const note = tryAsNote(line);
  assert(note);
  return note;
}

function asString(line) {
  assert(typeof line === "string");
  return line;
}

const commits = groupedLines
  .filter((g) => g.length > 1)
  .map((c) => ({
    hash: asString(c[0]),
    edits: c
      .slice(1)
      .filter((e) => !tryAsNote(e))
      .map((e) => {
        const m = e[0].match(/^(.*) \((.*?)\)$/);
        if (!m) {
          throw new Error(`Invalid edit line: ${e[0]}`);
        }
        return { type: m[1], cursors: m[2], notes: e.slice(1).map(asNote) };
      }),
    notes: c
      .slice(1)
      .map(tryAsNote)
      .filter((v) => v),
  }));

assert(commits.length === 71);
console.log(JSON.stringify(commits, null, 2));
