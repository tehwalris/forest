import ts from "typescript";

export interface Doc {
  root: ListNode;
  text: string;
}

export interface TextRange {
  pos: number;
  end: number;
}

export enum NodeKind {
  Token,
  List,
}

export type Node = TokenNode | ListNode;

interface BaseNode extends TextRange {
  isPlaceholder?: boolean;
}

export interface TokenNode extends BaseNode {
  kind: NodeKind.Token;
  tsNode: ts.Node;
}

export enum ListKind {
  TightExpression,
  LooseExpression,
  ParenthesizedExpression,
  ElementAccessExpressionArgument,
  CallArguments,
  IfBranches,
  IfBranch,
  ObjectLiteralElement,
  UnknownTsNodeArray,
  TsNodeStruct,
  TsNodeList,
  File,
}

export interface ListNode extends BaseNode {
  kind: NodeKind.List;
  listKind: ListKind;
  tsNode?: ts.Node;
  structKeys?: string[];
  delimiters: [string, string];
  content: Node[];
  equivalentToContent: boolean;
}

export type Path = number[];
export type EvenPathRange = { anchor: Path; offset: number };
export type UnevenPathRange = { anchor: Path; tip: Path };

export interface NodeWithPath {
  node: Node;
  path: Path;
}

export interface InsertState {
  beforePos: number[];
  text: string;
}
