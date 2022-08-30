const fs = require("fs");
const path = require("path");
const assert = require("assert");
const R = require("ramda");
const { notesToGroupedLines } = require("./util");
const { parseResults, reasonsBySlug } = require("./parse-codemod-support");

const notesPath = path.join(__dirname, "codemod-support.md");

function summarizeResults(results) {
  assert(
    Array.isArray(results) &&
      results.every((r) => ["no", "maybe", "yes"].includes(r)),
  );
  return [
    results.length,
    ...["no", "maybe", "yes"].map(
      (target) => results.filter((r) => r === target).length,
    ),
  ].join(" & ");
}

const notes = fs.readFileSync(notesPath, "utf8");
const groupedLines = notesToGroupedLines(notes);

const results = parseResults(groupedLines);
console.log(JSON.stringify(results, null, 2));

const resultsBySlug = new Map(
  [...reasonsBySlug.keys()].map((slug) => [slug, []]),
);
const codemods = results.repos.flatMap((r) => r.codemods);
for (const codemod of codemods) {
  for (const issue of codemod.issues) {
    resultsBySlug.get(issue.slug).push(codemod.result);
  }
}
console.log(resultsBySlug);

const sortedSlugs = R.sortBy(
  (slug) => -resultsBySlug.get(slug).length,
  R.sortBy((slug) => reasonsBySlug.get(slug), [...reasonsBySlug.keys()]),
).filter((slug) => resultsBySlug.get(slug).length);
console.log(sortedSlugs);

const latexOutput = sortedSlugs
  .map((slug) => {
    const results = resultsBySlug.get(slug);
    const exactReason = reasonsBySlug.get(slug);
    return String.raw`${summarizeResults(results)} & ${exactReason} \\`;
  })
  .join("\n");
console.log(latexOutput);

console.log({
  ...R.countBy((c) => c.result, codemods),
  totalWithoutIgnore: codemods.filter((c) => c.result !== "ignore").length,
});
