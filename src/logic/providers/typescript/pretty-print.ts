import { FileNode } from "./typescript-provider";
import { format as prettierFormat } from "prettier";

const PRETTIER_OPTIONS = {
  parser: "typescript",
  printWidth: 80,
  trailingComma: "all",
} as const;

export function tryPrettyPrint(fileNode: FileNode): string | undefined {
  return fileNode.prettyPrint(t => {
    try {
      return prettierFormat(t, PRETTIER_OPTIONS);
    } catch (e) {
      console.warn("Failed to run prettier", e);
    }
    return t;
  })?.text;
}
