import ts from "typescript";
import { CompilerHost } from "./compiler-host";

const fakeFileName = "file.ts";
const languageVersion = ts.ScriptTarget.ES2020;

export function astFromTypescriptFileContent(fileContent: string) {
  const compilerHost = new CompilerHost();
  const file = compilerHost.addFile(fakeFileName, fileContent, languageVersion);
  return file;
}

export function createScanner(fileContent: string): ts.Scanner {
  return ts.createScanner(
    languageVersion,
    true,
    undefined,
    fileContent,
    (err) => {
      throw new Error("err");
    },
  );
}
