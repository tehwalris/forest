import * as ts from "typescript";
import { Node, ChildNodeEntry, BuildResult } from "../../tree/node";
import { CompilerHost } from "./compiler-host";
import { StructNode, ListNode } from "../../tree/base-nodes";
import { unions } from "./generated/templates";
import { fromTsNode } from "./convert";
import * as _fsType from "fs";
import { tryPrettyPrint } from "./pretty-print";
import * as path from "path";
import * as R from "ramda";
type DirectoryTree =
  | string
  | {
      [pathSegment: string]: DirectoryTree;
    };
interface WorkingSet {
  files: Map<string, string>;
  rootFiles: string[];
  directoryTree: DirectoryTree;
}
export class TypescriptProvider {
  program?: ts.Program;
  compilerHost = new CompilerHost();
  constructor(private fs: typeof _fsType, private projectRoot: string) {}
  private readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fs.readFile(
        path.join(this.projectRoot, filePath),
        "utf-8",
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });
  }
  private writeFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fs.writeFile(path.join(this.projectRoot, filePath), content, err => {
        if (err) {
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  }
  async loadTree(filePath: string): Promise<Node<Map<string, ts.SourceFile>>> {
    const pathParts = filePath.split(path.sep);
    const fileContent = await this.readFile(filePath);
    this.compilerHost.addFile(filePath, fileContent, ts.ScriptTarget.ES5);
    this.program = ts.createProgram(
      [filePath],
      { lib: ["es5"] },
      this.compilerHost,
      this.program,
    );
    const directoryTree = R.assocPath(pathParts, filePath, {});
    return nodeFromDirectoryTree(directoryTree, this.program);
  }
  async trySaveFile(file: FileNode) {
    const text = tryPrettyPrint(file);
    if (text) {
      await this.writeFile(file.filePath, text);
    }
  }
}
export class FileNode extends ListNode<
  ts.Statement,
  Map<string, ts.SourceFile>
> {
  flags = {};
  links: never[] = [];
  constructor(
    value: Node<ts.Statement>[],
    private file: ts.SourceFile,
    public readonly filePath: string,
  ) {
    super(value);
  }
  clone(): FileNode {
    const node = new FileNode(this.value, this.file, this.filePath);
    node.id = this.id;
    return node;
  }
  static fromFile(file: ts.SourceFile, filePath: string): FileNode {
    return new FileNode(
      file.statements.map(statement => fromTsNode(statement, unions.Statement)),
      file,
      filePath,
    );
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<Map<string, ts.SourceFile>> {
    return this.listBuildHelper(
      children =>
        new Map<string, ts.SourceFile>([
          [this.filePath, ts.updateSourceFileNode(this.file, children)],
        ]),
    );
  }
  prettyPrint(
    format?: (fileText: string) => string,
  ):
    | {
        node: FileNode;
        text: string;
      }
    | undefined {
    const result = this.build();
    if (!result.ok) {
      return undefined;
    }
    const oldFile = [...result.value.values()][0];
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const unformattedText = printer.printNode(
      ts.EmitHint.SourceFile,
      oldFile,
      oldFile,
    );
    let text = unformattedText;
    try {
      if (format) {
        text = format(unformattedText);
      }
    } catch (e) {
      console.warn("error while formatting", e);
    }
    const newFile = ts.createSourceFile(
      oldFile.fileName,
      text,
      oldFile.languageVersion,
    );
    return { node: FileNode.fromFile(newFile, this.filePath), text };
  }
  protected setValue(value: Node<ts.Statement>[]): FileNode {
    const node = new FileNode(value, this.file, this.filePath);
    node.id = this.id;
    return node;
  }
  protected createChild(): Node<ts.Statement> {
    return fromTsNode(
      unions.Statement().EmptyStatement.default as ts.Statement,
      unions.Statement,
    );
  }
}
class DirectoryNode extends StructNode<
  Map<string, ts.SourceFile>,
  Map<string, ts.SourceFile>
> {
  links: never[] = [];
  flags = {};
  constructor(public children: ChildNodeEntry<Map<string, ts.SourceFile>>[]) {
    super();
  }
  clone(): DirectoryNode {
    const node = new DirectoryNode(this.children);
    node.id = this.id;
    return node;
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<Map<string, ts.SourceFile>> {
    const builtChildren = this.buildChildren();
    if (!builtChildren.ok) {
      return builtChildren;
    }
    const files = new Map<string, ts.SourceFile>();
    Object.values(builtChildren.value).forEach(childFiles => {
      childFiles.forEach((sourceFile, filePath) =>
        files.set(filePath, sourceFile),
      );
    });
    return { ok: true, value: files };
  }
  protected createChild(): never {
    throw new Error("Not implemented");
  }
  protected setChildren(
    children: ChildNodeEntry<Map<string, ts.SourceFile>>[],
  ): DirectoryNode {
    const node = new DirectoryNode(children);
    node.id = this.id;
    return node;
  }
}
function nodeFromDirectoryTree(
  directoryTree: DirectoryTree,
  program: ts.Program,
): Node<Map<string, ts.SourceFile>> {
  if (typeof directoryTree === "string") {
    const file = program.getSourceFile(directoryTree);
    if (!file) {
      console.warn(`file not found: ${directoryTree}`);
      return new DirectoryNode([]);
    }
    return FileNode.fromFile(file, directoryTree);
  } else {
    const childEntries = Object.entries(directoryTree).map(
      ([key, subdirectoryTree]) => ({
        key,
        node: nodeFromDirectoryTree(subdirectoryTree, program),
      }),
    );
    return new DirectoryNode(childEntries);
  }
}
