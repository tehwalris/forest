import { FileNode } from "./typescript-provider";
import { format as _prettierFormat } from "prettier/standalone";
import type { Options } from "prettier";
import parserTypescript from "prettier/parser-typescript";

const PRETTIER_OPTIONS: Options = {
  parser: "typescript",
  printWidth: 80,
  trailingComma: "all",
  plugins: [parserTypescript],
};

export function prettierFormat(t: string): string {
  return _prettierFormat(t, PRETTIER_OPTIONS);
}

export function tryPrettyPrint(fileNode: FileNode): string | undefined {
  return fileNode.prettyPrint((t) => {
    try {
      return prettierFormat(t);
    } catch (e) {
      console.warn("Failed to run prettier", e);
    }
    return t;
  })?.text;
}
