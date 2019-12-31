import { FileNode } from "./typescript-provider";
import { format as prettierFormat } from "prettier";

const PRETTIER_OPTIONS = {
  parser: "typescript" as "typescript",
  printWidth: 80,
  plugins: undefined,
};

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
