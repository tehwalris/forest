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

export interface TokenNode extends TextRange {
  kind: NodeKind.Token;
  tsNode: ts.Node;
  isPlaceholder?: boolean;
}

export enum ListKind {
  TightExpression,
  LooseExpression,
  ParenthesizedExpression,
  CallArguments,
  File,
}

export interface ListNode extends TextRange {
  kind: NodeKind.List;
  listKind: ListKind;
  delimiters: [string, string];
  content: Node[];
  equivalentToContent: boolean;
  isPlaceholder?: boolean;
}

export type Path = number[];
export type EvenPathRange = { anchor: Path; offset: number };
export type UnevenPathRange = { anchor: Path; tip: Path };

export interface NodeWithPath {
  node: Node;
  path: Path;
}
