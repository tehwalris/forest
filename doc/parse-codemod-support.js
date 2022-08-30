const assert = require("assert");
const { invertMap, mapFromJson } = require("./util");

const slugsByReason = mapFromJson("codemod-support-reason-slugs.json");
const reasonsBySlug = invertMap(slugsByReason);

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
  return { name: m[1], result: m[2] === "almost" ? "maybe" : m[2] };
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
  if (!output.notes) {
    output.notes = [];
  }
  if (!output.codemods) {
    output.codemods = [];
  }
  return output;
}

function parseResults(lines) {
  return {
    repos: lines.map(parseResultsForRepo),
  };
}

module.exports = { parseResults, slugsByReason, reasonsBySlug };
