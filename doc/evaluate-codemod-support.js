const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION } = require("constants");

const notesPath = path.join(__dirname, "codemod-support.md");
const mapFromJson = (filename) =>
  new Map(JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf-8")));
const invertMap = (m) => new Map([...m.entries()].map(([k, v]) => [v, k]));
const reasonsByExactReason = mapFromJson("codemod-support-reason-mapping.json");
const exactReasonsByReason = invertMap(reasonsByExactReason);
const slugsByReason = mapFromJson("codemod-support-reason-slugs.json");
const reasonsBySlug = invertMap(slugsByReason);

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

function parseIssueLine(lines) {
  assert(typeof lines === "string");
  const m = lines.match(/^([a-z_]+): (.+)$/);
  assert(m);
  const slug = m[1];
  assert(reasonsBySlug.has(slug));
  return { slug, exactReason: m[2] };
}

function parseCodemodBullet(lines) {
  if (typeof lines === "string") {
    if (lines.startsWith("note: ") || lines.startsWith("ignore: ")) {
      return { issues: [], notes: lines };
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
  output.issues = output.issues.map(parseIssueLine);
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
  return {
    repos: lines.map(parseResultsForRepo),
  };
}

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

console.log(JSON.stringify(parseResults(groupedLines), null, 2));
