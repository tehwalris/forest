import * as ts from "typescript";
import { Node, ChildNodeEntry, BuildResult } from "../../tree/node";
import { CompilerHost } from "./compiler-host";
import { StructNode, ListNode } from "../../tree/base-nodes";
import { unions } from "./generated/templates";
import { fromTsNode } from "./convert";
interface WorkingSet {
  files: Map<string, string>;
  rootFiles: string[];
}
export class TypescriptProvider {
  file = `
  import {
    Node,
    DisplayInfoPriority,
    LabelStyle,
    DisplayInfo,
  } from "../../tree/node";
  import * as ts from "typescript";
  export type Enchancer<T extends Node<ts.Node>> = (
    node: T,
  ) => {
    displayInfo: DisplayInfo;
  };
  export const enchancers: {
    [key: string]: Enchancer<Node<ts.Node>> | undefined;
  } = {
    ClassDeclaration: (node => ({
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "class", style: LabelStyle.SECTION_NAME }],
      },
    })) as Enchancer<Node<ts.ClassDeclaration>>,
  };
  `;

  loadTree(filePath: string): Node<WorkingSet> {
    return RootNode.fromState({
      files: new Map(
        [filePath].map(p => [p, this.file]) as Array<[string, string]>,
      ),
      rootFiles: [filePath],
    });
  }
  saveFile(filePath: string, file: FileNode) {
    const buildResult = file.build();
    if (buildResult.ok) {
      this.file = buildResult.value.getText();
    }
  }
}
export class RootNode extends StructNode<FileNode, WorkingSet> {
  links: never[] = [];
  children: ChildNodeEntry<ts.SourceFile>[];
  flags = {};
  private state: WorkingSet;
  constructor(children: ChildNodeEntry<ts.SourceFile>[], state: WorkingSet) {
    super();
    this.children = children;
    this.state = state;
  }
  clone(): RootNode {
    const node = new RootNode(this.children, this.state);
    node.id = this.id;
    return node;
  }
  static fromState(state: WorkingSet): RootNode {
    const host = new CompilerHost();
    state.files.forEach((content, name) =>
      host.addFile(name, content, ts.ScriptTarget.ES5),
    );
    const program = ts.createProgram(state.rootFiles, { lib: ["es5"] }, host);
    const children = state.rootFiles.map(name => {
      const file = program.getSourceFile(name);
      if (!file) {
        throw new Error(`file not found: ${name}`);
      }
      return {
        key: name.split("/")[name.split("/").length - 1],
        node: FileNode.fromFile(file),
      };
    });
    return new RootNode(children, state);
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<WorkingSet> {
    const builtChildren = this.buildChildren();
    if (!builtChildren.ok) {
      return builtChildren;
    }
    const files = new Map();
    Object.keys(builtChildren.value).forEach(key =>
      files.set(key, builtChildren.value[key]),
    );
    return { ok: true, value: { ...this.state, files } };
  }
  protected createChild(): never {
    throw new Error("Not implemented");
  }
  protected setChildren(children: ChildNodeEntry<ts.SourceFile>[]): RootNode {
    const node = new RootNode(children, this.state);
    node.id = this.id;
    return node;
  }
}
export class FileNode extends ListNode<ts.Statement, ts.SourceFile> {
  flags = {};
  links: never[] = [];
  private file: ts.SourceFile;
  constructor(value: Node<ts.Statement>[], file: ts.SourceFile) {
    super(value);
    this.file = file;
  }
  clone(): FileNode {
    const node = new FileNode(this.value, this.file);
    node.id = this.id;
    return node;
  }
  static fromFile(file: ts.SourceFile): FileNode {
    return new FileNode(
      file.statements.map(statement => fromTsNode(statement, unions.Statement)),
      file,
    );
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<ts.SourceFile> {
    return this.listBuildHelper(children =>
      ts.updateSourceFileNode(this.file, children),
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
    const oldFile = result.value;
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
    return { node: FileNode.fromFile(newFile), text };
  }
  protected setValue(value: Node<ts.Statement>[]): FileNode {
    const node = new FileNode(value, this.file);
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
