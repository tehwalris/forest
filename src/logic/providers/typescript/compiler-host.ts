import * as ts from "typescript";
export class CompilerHost implements ts.CompilerHost {
  private _files: {
    [s: string]: ts.SourceFile;
  };
  constructor() {
    this._files = {};
  }
  public getDefaultLibFileName(options: ts.CompilerOptions): string {
    return this.getDefaultLibFilePaths(options)[0];
  }
  public getDefaultLibFilePaths(options: ts.CompilerOptions): string[] {
    if (!options.lib) {
      throw new Error("No libs specified");
    }
    return options.lib.map((libName) => `typescript/lib/lib.${libName}.d.ts`);
  }
  public useCaseSensitiveFileNames(): boolean {
    return false;
  }
  public getCanonicalFileName(fileName: string): string {
    return (ts as any).normalizePath(fileName);
  }
  public getCurrentDirectory(): string {
    return "";
  }
  public getNewLine(): string {
    return "\n";
  }
  public readFile(fileName: string): string {
    throw new Error("Not implemented");
  }
  public writeFile(name: string, text: string, writeByteOrderMark: boolean) {
    throw new Error("Not implemented");
  }
  public getSourceFile(fileName: string): ts.SourceFile {
    fileName = this.getCanonicalFileName(fileName);
    return this._files[fileName];
  }
  public getAllFiles(): ts.SourceFile[] {
    return Object.keys(this._files).map((key) => this._files[key]);
  }
  public fileExists(fileName: string): boolean {
    return !!this.getSourceFile(fileName);
  }
  public addFile(
    fileName: string,
    text: string,
    target: ts.ScriptTarget,
  ): ts.SourceFile {
    fileName = this.getCanonicalFileName(fileName);
    this._files[fileName] = ts.createSourceFile(fileName, text, target);
    return this._files[fileName];
  }
}
