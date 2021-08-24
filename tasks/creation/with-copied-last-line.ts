// src/logic/tree/display-line.ts

type Line = any;

function copyLine(line: Line): Line {
  return { indent: line.indent, content: [...line.content] };
}

export function withCopiedLastLine(lines: Line[]): Line[] {
  if (lines.length === 0) {
    return [];
  }
  const output = [...lines];
  output[output.length - 1] = copyLine(output[output.length - 1]);
  return output;
}
