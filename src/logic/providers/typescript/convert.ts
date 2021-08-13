import * as ts from "typescript";
import { ActionSet } from "../../tree/action";
import { BuildResult, Node } from "../../tree/node";
import { Enhancer } from "./enhancer";
import {
  listTemplates,
  stringTemplates,
  structTemplates,
} from "./generated/templates";
import {
  ListTemplate,
  ListTemplateNode,
  StringTemplate,
  StringTemplateNode,
  StructTemplate,
  StructTemplateNode,
  TemplateUnionNode,
  Union,
} from "./template-nodes";
export function fromTsNode<T extends ts.Node | undefined>(
  original: T,
  _union?: Union<T>,
  listEnhancer?: undefined,
  useHolesForChildren?: boolean,
  nextFromTsNode?: unknown,
): Node<T>;
export function fromTsNode<T extends ts.Node | undefined>(
  original: ts.NodeArray<NonNullable<T>>,
  _union: Union<T>,
  listEnhancer?: Enhancer<Node<ts.NodeArray<NonNullable<T>>>>,
): Node<ts.NodeArray<NonNullable<T>>>;
export function fromTsNode<T extends ts.Node | undefined>(
  _original: T | ts.NodeArray<NonNullable<T>>,
  _union: Union<T> | undefined,
  listEnhancer: Enhancer<Node<ts.NodeArray<NonNullable<T>>>> | undefined,
  useHolesForChildren: boolean = false,
  nextFromTsNode: any = fromTsNode,
): Node<T> {
  if (_original !== undefined && isNodeArray(_original)) {
    return ListTemplateNode.fromTemplate(
      {
        match: (() => false) as any,
        load: (built: any) => built as ts.NodeArray<NonNullable<T>>,
        build: (children: NonNullable<T>[]) =>
          ts.createNodeArray(children) as any,
        flags: [],
        childUnion: _union! as Union<NonNullable<T>>,
        enhancer: listEnhancer,
      },
      _original,
      nextFromTsNode,
    ) as any;
  }
  if (_union) {
    const union = _union.getMembers();
    if (Object.keys(union).length > 1) {
      return TemplateUnionNode.fromUnion(_union, _original, nextFromTsNode);
    }
  }
  if (_original === undefined) {
    throw new Error(
      "original === undefined is only supported in a non-empty union",
    );
  }
  const original: NonNullable<T> = _original as any;
  for (const template of stringTemplates) {
    if (template.match(_original)) {
      return StringTemplateNode.fromTemplate(
        template as any as StringTemplate<NonNullable<T>>,
        original,
      ) as any;
    }
  }
  for (const template of listTemplates) {
    if (template.match(_original)) {
      return ListTemplateNode.fromTemplate(
        template as any as ListTemplate<NonNullable<T>, ts.Node>,
        original,
        nextFromTsNode,
      ) as any;
    }
  }
  for (const template of structTemplates) {
    if (template.match(_original)) {
      return StructTemplateNode.fromTemplate(
        template as any as StructTemplate<{}, NonNullable<T>>,
        original,
        nextFromTsNode,
        useHolesForChildren,
      ) as any;
    }
  }
  return new UnsupportedSyntaxNode(original);
}
function isNodeArray<T extends ts.Node>(
  v: T | ts.NodeArray<T>,
): v is ts.NodeArray<T> {
  return (
    !("kind" in v) &&
    "length" in v &&
    typeof (v as ts.NodeArray<T>).length === "number"
  );
}
class UnsupportedSyntaxNode<T extends ts.Node> extends Node<T> {
  children = [];
  flags = {};
  actions: ActionSet<never> = {};
  private original: T;
  constructor(value: T) {
    super();
    this.original = value;
  }
  clone(): UnsupportedSyntaxNode<T> {
    const node = new UnsupportedSyntaxNode(this.original);
    node.id = this.id;
    return node;
  }
  setChild(child: never): never {
    throw new Error("UnsupportedSyntaxNode can't have children");
  }
  setFlags(flags: never): never {
    throw new Error("UnsupportedSyntaxNode can't have flags");
  }
  getDebugLabel() {
    return "!" + ts.SyntaxKind[this.original.kind];
  }
  build(): BuildResult<T> {
    return { ok: true, value: this.original };
  }
}
