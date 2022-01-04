const fs = require('fs');

const notesPath = '/home/philippe/a/src/github.com/tehwalris/forest/doc/interesting-commit-notes.md';

const notes = fs.readFileSync(notesPath, 'utf-8');
const m = notes.match(/^-\s*(.*)\n(?=-|$)/m)
console.log(m[1]);
