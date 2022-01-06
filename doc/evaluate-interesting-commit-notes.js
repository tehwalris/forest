const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { groupBy, countBy } = require("ramda");

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

function cleanCursorCount(c) {
  if (c.match(/^\d+$/)) {
    if (+c > 10) {
      return ">10";
    }
    return c;
  }
  switch (c) {
    case "2-3":
      return "2";
    case ">10":
      return ">10";
    default:
      throw new Error(`Unhandled cursor count: ${c}`);
  }
}

function asCoarseEditType(t) {
  return (
    {
      "remove required argument": "add/remove required argument/property",
      "remove required property": "add/remove required argument/property",
      "add required argument": "add/remove required argument/property",
      "add required property": "add/remove required argument/property",
      "extract expression into function":
        "extract expression into function/variable",
      "extract expression into variable":
        "extract expression into function/variable",
      "wrap expression": "wrap expression/statement",
      "wrap statements": "wrap expression/statement",
    }[t] || t
  );
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

const results = {
  commitsWithNoEditsNotes: commits
    .filter((c) => !c.edits.length)
    .map((c) => c.notes),
  commitsByNumberOfEdits: countBy((c) => c.edits.length, commits),
  totalEdits: commits.reduce((sum, c) => sum + c.edits.length, 0),
  editsByType: countBy(
    (e) => e.type,
    commits.flatMap((c) => c.edits),
  ),
  editsByCoarseType: countBy(
    (e) => asCoarseEditType(e.type),
    commits.flatMap((c) => c.edits),
  ),
  editsByCursors: countBy(
    (e) => cleanCursorCount(e.cursors),
    commits.flatMap((c) => c.edits),
  ),
};
console.log(JSON.stringify(results, null, 2));
