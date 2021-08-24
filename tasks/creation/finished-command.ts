// src/logic/tree/display-line.ts

var InternalCommandKind,
  doc,
  mode,
  currentPos,
  indentStack,
  output,
  currentLine: any;

export const finishedCommand = {
  kind: InternalCommandKind.DocFinished,
  doc,
  startedAt: {
    state: {
      mode,
      currentPos,
      indentStack: [...indentStack],
    },
    lineCount: output.length,
    currentLineContentLength: currentLine.content.length,
  },
};
