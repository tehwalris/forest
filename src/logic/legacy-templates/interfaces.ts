import * as ts from "typescript";

export enum FlagKind {
  VARIABLE_FLAVOR = "variableFlavor",
  EXPORT = "export",
  AMBIENT = "ambient",
  DEFAULT = "default",
  ACCESSIBILITY = "accessibility",
  STATIC = "static",
  READONLY = "readonly",
  ABSTRACT = "abstract",
  ASYNC = "async",
}

export type Union<T extends ts.Node | undefined> = {
  name: string;
  getMembers: () => {
    [key: string]: {
      match: (node: ts.Node | undefined) => node is T;
      default: T;
    };
  };
};

export interface Template<B extends ts.Node> {
  match: (built: ts.Node) => built is B;
}

export interface StringTemplate<B extends ts.Node> extends Template<B> {
  load: (built: B) => string;
  build: (text: string) => B;
}

export interface ListTemplate<B extends ts.Node, C extends ts.Node>
  extends Template<B> {
  load: (built: B) => ts.NodeArray<C>;
  build: (children: C[], modifiers: ts.Modifier[]) => B;
  flags: FlagKind[];
  childUnion: Union<C>;
}

interface BaseStructChild<T extends ts.Node> {
  union: Union<T>;
}

export interface RequiredStructSingleChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: T;
  optional?: never;
  isList?: never;
}

export interface OptionalStructSingleChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: T | undefined;
  optional: true;
  isList?: never;
}

export interface RequiredStructListChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: ts.NodeArray<T>;
  optional?: never;
  isList: true;
}

export interface OptionalStructListChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: ts.NodeArray<T> | undefined;
  optional: true;
  isList: true;
}

export type StructChild<T extends ts.Node> =
  | RequiredStructSingleChild<T>
  | OptionalStructSingleChild<T>
  | RequiredStructListChild<T>
  | OptionalStructListChild<T>;

export interface StructTemplate<
  C extends {
    [key: string]: StructChild<any>;
  },
  B extends ts.Node,
> extends Template<B> {
  load: (built: B) => C;
  build: (
    children: { [CK in keyof C]: C[CK]["value"] },
    modifiers: ts.Modifier[],
  ) => B;
  flags: FlagKind[];
  children: string[];
}
