// src/logic/tree/display-line.ts

var InternalCommandKind: any;
var doc: any;
var mode: any;
var currentPos: any;
var indentStack: any;
var output: any;
var currentLine: any;

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
