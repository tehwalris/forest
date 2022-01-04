const fs = require('fs');

const notesPath = '/home/philippe/a/src/github.com/tehwalris/forest/doc/interesting-commit-notes.md';

function reportProgress() {
  const notes = fs.readFileSync(notesPath, 'utf-8');

  const totalExamples = (notes.match(/^-/gm) || []).length;
  const unfinishedExamples = (notes.match(/^-.*\n(?=-|$)/gm) || []).length;

  const progress = 1 - (unfinishedExamples / totalExamples);
  if (Number.isNaN(progress)) {
    return;
  }

  console.log(Date.now(), progress);
}

reportProgress();

fs.watch(notesPath, (event, filename) => {
  if (filename) {
    reportProgress();
  }
});
