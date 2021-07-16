import { FileNode } from "./typescript-provider";
import { format as prettierFormat } from "prettier/standalone";
import type { Options } from "prettier";
import parserTypescript from "prettier/parser-typescript";

const PRETTIER_OPTIONS: Options = {
  parser: "typescript",
  printWidth: 80,
  trailingComma: "all",
  plugins: [parserTypescript],
};

export function tryPrettyPrint(fileNode: FileNode): string | undefined {
  return fileNode.prettyPrint((t) => {
    try {
      return prettierFormat(t, PRETTIER_OPTIONS);
    } catch (e) {
      console.warn("Failed to run prettier", e);
    }
    return t;
  })?.text;
}
