const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { countBy, flatten } = require("ramda");
const { createNoSubstitutionTemplateLiteral } = require("typescript");

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

const notesPath = path.join(__dirname, "codemod-support.md");

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
assert(
  groupedLines.length === 2 &&
    groupedLines[0][0] === "raw results" &&
    groupedLines[1][0].startsWith("reasons"),
);

function parseRepoNotes(lines) {
  assert(
    Array.isArray(lines) && lines.length >= 2 && lines[0] === "general notes",
  );
  return lines.slice(1);
}

function concatCodemodBullets(bullets) {
  const output = {};
  for (const k of ["issues", "notes"]) {
    output[k] = bullets.flatMap((b) => b[k]);
  }
  return output;
}

function issuesToNotes({ issues, notes }) {
  return {
    issues: [],
    notes: [...issues, ...notes],
  };
}

function parseCodemodBullet(lines) {
  if (typeof lines === "string") {
    if (lines.startsWith("note: ")) {
      return { issues: [], notes: lines.slice("note: ") };
    } else {
      return { issues: [lines], notes: [] };
    }
  } else {
    assert(Array.isArray(lines) && lines.length >= 1);
    return concatCodemodBullets([
      parseCodemodBullet(lines[0]),
      ...lines.slice(1).map(parseCodemodBullet).map(issuesToNotes),
    ]);
  }
}

function parseCodemodNameLine(lines) {
  assert(typeof lines === "string");
  const m = lines.match(/^`(.*)` \((no|maybe|almost|yes|ignore)\)$/);
  assert(m);
  return { name: m[1], result: m[2] };
}

function parseCodemod(lines) {
  assert(Array.isArray(lines) && lines.length >= 1);
  const output = {
    ...parseCodemodNameLine(lines[0]),
  };
  const bullets = concatCodemodBullets(lines.slice(1).map(parseCodemodBullet));
  Object.assign(
    output,
    output.result === "ignore" ? issuesToNotes(bullets) : bullets,
  );
  return output;
}

function parseCodemods(lines) {
  assert(Array.isArray(lines) && lines.length >= 2 && lines[0] === "codemods");
  return lines.slice(1).map(parseCodemod);
}

function parseRepoNameLine(lines) {
  assert(typeof lines === "string");
  const m = lines.match(/^`(.*)`(?: \((no|ignore)\))?$/);
  assert(m);
  return { name: m[1], result: m[2] };
}

function parseResultsForRepo(lines) {
  assert(Array.isArray(lines) && lines.length >= 1);
  const output = { ...parseRepoNameLine(lines[0]) };
  for (const childLines of lines.slice(1)) {
    assert(Array.isArray(childLines) && childLines.length >= 1);
    if (childLines[0] === "general notes") {
      assert(!output.notes);
      output.notes = parseRepoNotes(childLines);
    } else if (childLines[0] === "codemods") {
      assert(!output.codemods);
      output.codemods = parseCodemods(childLines);
    } else {
      assert(false);
    }
  }
  return output;
}

function parseResults(lines) {
  assert(
    Array.isArray(lines) && lines.length >= 2 && lines[0] === "raw results",
  );
  return {
    repos: lines.slice(1).map(parseResultsForRepo),
  };
}

function flattenLines(lines) {
  if (typeof lines === "string") {
    return [lines];
  }
  assert(Array.isArray(lines));
  return lines.flatMap((l) => flattenLines(l));
}

function parseReason(lines) {
  assert(
    Array.isArray(lines) && lines.length >= 1 && typeof lines[0] === "string",
  );
  const m = lines[0].match(/^\((\d+)\) (.*)$/);
  assert(m);
  return { reason: m[2], count: +m[1], notes: flattenLines(lines.slice(1)) };
}

function parseReasons(lines) {
  assert(
    Array.isArray(lines) && lines.length >= 2 && lines[0].startsWith("reasons"),
  );
  return lines.slice(1).map(parseReason);
}

console.log(
  JSON.stringify(
    {
      results: parseResults(groupedLines[0]),
      reasons: parseReasons(groupedLines[1]),
    },
    null,
    2,
  ),
);
