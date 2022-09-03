const fs = require("fs");
const path = require("path");
const assert = require("assert");
const R = require("ramda");
const { notesToGroupedLines, capitalizeFirst } = require("./util");
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
  console.log(JSON.stringify(lines));
  const m = lines.match(/^`([^`]+)`( \(ignore\))?$/);
  assert(m);
  return { name: m[1], ignore: !!m[2] };
}

function parseResultsForRepo(lines) {
  assert(Array.isArray(lines) && lines.length >= 1);
  const output = parseRepoNameLine(lines[0]);
  if (output.ignore) {
    output.ignoreReason = lines.slice(1);
  } else {
    output.codemods = lines.slice(1).map(parseCodemod);
  }
  return output;
}

function parseResults(lines) {
  return {
    repos: lines.map(parseResultsForRepo),
  };
}

function basicLatexEscape(s) {
  return s.replaceAll("_", "\\_");
}

function generateLatexScriptSummaryForCodemod({ name, purpose, support }) {
  const issuesString = support.issues.length
    ? R.sortBy((v) => v.id, support.issues)
        .map((v) => v.id)
        .filter((v) => v)
        .join(", ")
    : "none";
  return [
    String.raw`\paragraph{\texttt{${basicLatexEscape(name)}}}`,
    String.raw`\hangindent=\parindent`,
    String.raw`\mbox{}\newline{}`,
    support.result === "ignore"
      ? String.raw`\emph{This script was ignored}`
      : String.raw`Result: \emph{${support.result}}; Issues: ${issuesString}`,
    String.raw`\newline{}`,
    purpose.description
      .map((s) => {
        assert(s.length === 1);
        return `${capitalizeFirst(s[0])}.`;
      })
      .join(" "),
  ].join("");
}

function generateLatexScriptSummariesForUsedRepo({ name, purpose, support }) {
  const grouped = purpose.codemods.map((purposeCodemod) => {
    const supportCodemod = support.codemods.find(
      (c) => c.name === purposeCodemod.name,
    );
    assert(!!supportCodemod);
    return {
      name: purposeCodemod.name,
      purpose: purposeCodemod,
      support: supportCodemod,
    };
  });
  return [
    String.raw`\subsubsection*{\texttt{${basicLatexEscape(name)}}}`,
    ...R.sortBy(({ name }) => name, grouped).map(
      generateLatexScriptSummaryForCodemod,
    ),
  ].join("\n");
}

function generateLatexScriptSummariesForIgnoredRepo({ name, purpose }) {
  return [
    String.raw`\subsubsection*{\texttt{${basicLatexEscape(name)}}}`,
    ...purpose.ignoreReason,
  ].join("\n");
}

function generateLatexScriptSummaries(purposesResults, supportResults) {
  const grouped = purposesResults.repos.map((purpose) => {
    const support = supportResults.repos.find((r) => r.name === purpose.name);
    assert(!!support);
    assert((support.result === "ignore") === purpose.ignore);
    return { name: purpose.name, purpose, support };
  });
  return [
    [true, generateLatexScriptSummariesForIgnoredRepo],
    [false, generateLatexScriptSummariesForUsedRepo],
  ]
    .map(([ignore, generate]) =>
      R.sortBy(({ name }) => name, grouped)
        .filter((g) => g.purpose.ignore === ignore)
        .map(generate)
        .join("\n"),
    )
    .join("\n\n");
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

console.log(supportResults);

console.log(generateLatexScriptSummaries(purposesResults, supportResults));
