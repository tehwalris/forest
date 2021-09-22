import ts from "typescript";
import { CompilerHost } from "./compiler-host";

const fakeFileName = "file.ts";
const languageVersion = ts.ScriptTarget.ES2020;

export function astFromTypescriptFileContent(fileContent: string) {
  const compilerHost = new CompilerHost();
  const file = compilerHost.addFile(fakeFileName, fileContent, languageVersion);
  return file;
}
