const fs = require("fs");
const path = require("path");
const assert = require("assert");

const notesPath = path.join(__dirname, "codemod-support.md");
const mapFromJson = (filename) =>
  new Map(JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf-8")));
const reasonsByExactReason = mapFromJson("codemod-support-reason-mapping.json");
const slugsByReason = mapFromJson("codemod-support-reason-slugs.json");
const reasonLinePrefix = "      - ";

const oldNotes = fs.readFileSync(notesPath, "utf-8");
const newNotes = oldNotes
  .split("\n")
  .map((line) => {
    if (!line.startsWith(reasonLinePrefix)) {
      return line;
    }
    const exactReason = line.slice(reasonLinePrefix.length).trim();
    const reason = reasonsByExactReason.get(exactReason);
    if (!reason) {
      return line;
    }
    const slug = slugsByReason.get(reason);
    assert(slug);
    return `${reasonLinePrefix}${slug}: ${exactReason}`;
  })
  .join("\n");
fs.writeFileSync(notesPath, newNotes);
