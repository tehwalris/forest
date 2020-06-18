import * as React from "react";
import * as ts from "typescript";

interface Props {
  file: ts.SourceFile;
}

export const CodeDisplay: React.FC<Props> = ({ file }) => {
  return (
    <div>
      {file.statements.map(s => (
        <pre>{s.getText(file)}</pre>
      ))}
    </div>
  );
};
