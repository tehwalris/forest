import * as ts from "typescript";
import {
  Node,
  ChildNodeEntry,
  BuildResult,
  DisplayInfo,
  DisplayInfoPriority,
  LabelStyle,
} from "../../tree/node";
import { CompilerHost } from "./compiler-host";
import { StructNode, ListNode, EmptyLeafNode } from "../../tree/base-nodes";
import { unions } from "./generated/templates";
import { fromTsNode } from "./convert";
import * as _fsType from "fs";
import { tryPrettyPrint } from "./pretty-print";
import * as path from "path";
import * as R from "ramda";
import { promisify } from "util";
import { ParentPathElement } from "../../parent-index";
import { RequiredHoleNode } from "./template-nodes";
type DirectoryTree =
  | string
  | {
      [pathSegment: string]: DirectoryTree;
    };
export class TypescriptProvider {
  program?: ts.Program;
  compilerHost = new CompilerHost();
  constructor(private fs: typeof _fsType, private projectRoot: string) {}
  private readFile(filePath: string): Promise<string> {
    return promisify(this.fs.readFile)(
      path.join(this.projectRoot, filePath),
      "utf8",
    );
  }
  private writeFile(filePath: string, content: string): Promise<void> {
    return promisify(this.fs.writeFile)(
      path.join(this.projectRoot, filePath),
      content,
      undefined,
    );
  }
  async loadTree(): Promise<Node<Map<string, ts.SourceFile>>> {
    const directoryTree = await this.loadDirectoryTree(this.projectRoot);
    const filePaths = filePathsFromDirectoryTree(directoryTree);
    await Promise.all(
      filePaths.map(async (filePath) => {
        const fileContent = await this.readFile(filePath);
        this.compilerHost.addFile(filePath, fileContent, ts.ScriptTarget.ES5);
      }),
    );
    this.program = ts.createProgram(
      filePaths,
      { lib: ["es5"] },
      this.compilerHost,
      this.program,
    );
    return nodeFromDirectoryTree(directoryTree, this.program);
  }
  async trySaveFile(file: FileNode) {
    const text = tryPrettyPrint(file);
    if (text !== undefined) {
      await this.writeFile(file.filePath, text);
    }
  }
  private async loadDirectoryTree(basePath: string): Promise<DirectoryTree> {
    const stats = await promisify(this.fs.stat)(basePath, { bigint: false });
    if (stats.isFile()) {
      return basePath;
    } else if (stats.isDirectory()) {
      const childNames = await promisify(this.fs.readdir)(basePath, undefined);
      const childTrees = await Promise.all(
        childNames.map((n) => this.loadDirectoryTree(path.join(basePath, n))),
      );
      const out: DirectoryTree = {};
      R.zip(childNames, childTrees).forEach(([k, v]) => {
        if (typeof v !== "string" || k.endsWith(".ts") || k.endsWith(".tsx")) {
          out[k] = v;
        }
      });
      return out;
    } else {
      return {};
    }
  }
}
export class FileNode extends ListNode<
  ts.Statement,
  Map<string, ts.SourceFile>
> {
  flags = {};
  constructor(
    value: Node<ts.Statement>[],
    private file: ts.SourceFile,
    public readonly filePath: string,
    placeholderNode: EmptyLeafNode,
  ) {
    super(value, placeholderNode);
  }
  clone(): FileNode {
    const node = new FileNode(
      this.value,
      this.file,
      this.filePath,
      this.placeholderNode,
    );
    node.id = this.id;
    return node;
  }
  static fromFile(file: ts.SourceFile, filePath: string): FileNode {
    return new FileNode(
      file.statements.map((statement) =>
        fromTsNode(statement, unions.Statement),
      ),
      file,
      filePath,
      ListNode.makePlaceholder(),
    );
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<Map<string, ts.SourceFile>> {
    return this.listBuildHelper(
      (children) =>
        new Map<string, ts.SourceFile>([
          [this.filePath, ts.updateSourceFileNode(this.file, children)],
        ]),
    );
  }
  prettyPrint(format?: (fileText: string) => string):
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
    const node = new FileNode(
      value,
      this.file,
      this.filePath,
      this.placeholderNode,
    );
    node.id = this.id;
    return node;
  }
  protected createChild(): Node<ts.Statement> {
    return RequiredHoleNode.tryWrap(
      fromTsNode(
        unions.Statement.getMembers().EmptyStatement.default as ts.Statement,
        unions.Statement,
      ),
    );
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo {
    if (!parentPath.length) {
      return {
        label: [{ style: LabelStyle.TYPE_SUMMARY, text: "file" }],
        priority: DisplayInfoPriority.LOW,
      };
    }
    return {
      label: [
        { style: LabelStyle.TYPE_SUMMARY, text: "file" },
        { style: LabelStyle.NAME, text: R.last(parentPath)!.childKey },
      ],
      priority: DisplayInfoPriority.MEDIUM,
    };
  }
}
class DirectoryNode extends StructNode<
  Map<string, ts.SourceFile>,
  Map<string, ts.SourceFile>
> {
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
    Object.values(builtChildren.value).forEach((childFiles) => {
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
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo {
    if (!parentPath.length) {
      return {
        label: [{ style: LabelStyle.TYPE_SUMMARY, text: "directory" }],
        priority: DisplayInfoPriority.LOW,
      };
    }
    return {
      label: [
        { style: LabelStyle.TYPE_SUMMARY, text: "directory" },
        { style: LabelStyle.NAME, text: R.last(parentPath)!.childKey },
      ],
      priority: DisplayInfoPriority.MEDIUM,
    };
  }
  getChildShortcuts() {
    const shortcuts = new Map<string, string[]>();
    for (const [i, { key }] of this.children.slice(0, 9).entries()) {
      shortcuts.set(`${i + 1}`, [key]);
    }
    return shortcuts;
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
function filePathsFromDirectoryTree(directoryTree: DirectoryTree): string[] {
  if (typeof directoryTree === "string") {
    return [directoryTree];
  }
  return Object.values(directoryTree).flatMap((subtree) =>
    filePathsFromDirectoryTree(subtree),
  );
}
