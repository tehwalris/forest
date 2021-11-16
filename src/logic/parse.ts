import ts from "typescript";
import { CompilerHost } from "./compiler-host";

const fakeFileName = "file.tsx";
const languageVersion = ts.ScriptTarget.ES2020;

export interface SourceFileWithDiagnostics extends ts.SourceFile {
  // HACK This field is private
  parseDiagnostics: ts.DiagnosticWithLocation[];
}

export function assertSourceFileHasDiagnostics(
  file: ts.SourceFile,
): asserts file is SourceFileWithDiagnostics {
  if (!(file as any).parseDiagnostics) {
    throw new Error("ts.SourceFile has no parseDiagnostics property");
  }
}

export function assertNoSyntaxErrors(
  file: SourceFileWithDiagnostics,
): SourceFileWithDiagnostics {
  if (file.parseDiagnostics.length) {
    console.warn("file has syntax errors", file);
    throw new Error("file has syntax errors");
  }
  return file;
}

export function astFromTypescriptFileContent(
  fileContent: string,
): SourceFileWithDiagnostics {
  const compilerHost = new CompilerHost();
  const file = compilerHost.addFile(fakeFileName, fileContent, languageVersion);
  assertSourceFileHasDiagnostics(file);
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
