// src/logic/tree/display-line.ts

var mode,
  PrintBreakMode,
  doc,
  LineKind,
  indentStack,
  output,
  currentLine,
  currentPos,
  NodeKind,
  spaceWidth: any;

type Line = any;

if (mode === PrintBreakMode.Break || doc.lineKind === LineKind.Hard) {
  const newLine: Line = { indent: R.last(indentStack)!, content: [] };
  output.push(newLine);
  currentLine = newLine;
  currentPos = newLine.indent;
} else if (mode === PrintBreakMode.Flat && doc.lineKind === LineKind.Normal) {
  // TODO use the real width of a space
  currentLine.content.push({
    kind: NodeKind.TightLeaf,
    size: [spaceWidth, 0],
  });
  if (currentPos !== undefined) {
    currentPos += spaceWidth;
  }
}
