const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { notesToGroupedLines } = require("./util");
const {
  parseResults: parseSupportResults,
} = require("./parse-codemod-support");

const purposesNotesPath = path.join(__dirname, "codemod-purposes.md");
const supportNotesPath = path.join(__dirname, "codemod-support.md");

function parseCodemodNameLine(lines) {
  assert(typeof lines === "string");
  const m = lines.match(/^`([^`]+)`$/);
  assert(m);
  return { name: m[1] };
}

function parseCodemod(lines) {
  assert(Array.isArray(lines) && lines.length >= 1);
  const output = {
    ...parseCodemodNameLine(lines[0]),
    description: lines.slice(1),
  };
  return output;
}

function parseRepoNameLine(lines) {
  assert(typeof lines === "string");
  const m = lines.match(/^(TODO )?`([^`]+)`$/);
  assert(m);
  return { name: m[2], todo: !!m[1] };
}

function parseResultsForRepo(lines) {
  assert(Array.isArray(lines) && lines.length >= 1);
  const output = {
    ...parseRepoNameLine(lines[0]),
    codemods: lines.slice(1).map(parseCodemod),
  };
  return output;
}

function parseResults(lines) {
  return {
    repos: lines.map(parseResultsForRepo),
  };
}

const supportResults = parseSupportResults(
  notesToGroupedLines(fs.readFileSync(supportNotesPath, "utf8")),
);

const notes = fs.readFileSync(purposesNotesPath, "utf8");
const groupedLines = notesToGroupedLines(notes);

console.log(groupedLines);

const purposesResults = parseResults(groupedLines);

console.log(purposesResults);
console.log(purposesResults.repos[1].codemods[0]);
