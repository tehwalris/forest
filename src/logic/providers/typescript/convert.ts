import * as ts from "typescript";
import { Node, BuildResult } from "../../tree/node";
import { UnionVariant } from "../../tree/base-nodes";
import { ActionSet, InputKind } from "../../tree/action";
import {
  StringTemplateNode,
  ListTemplateNode,
  StructTemplateNode,
  Union,
  StringTemplate,
  ListTemplate,
  StructTemplate,
  TemplateUnionNode,
} from "./template-nodes";
import {
  plainTypes,
  stringTemplates,
  listTemplates,
  structTemplates,
} from "./generated/templates";
export function fromTsNode<T extends ts.Node>(
  original: T,
  _union?: Union<T>,
): Node<T>;
export function fromTsNode<T extends ts.Node>(
  original: ts.NodeArray<T>,
  _union: Union<T>,
): Node<ts.NodeArray<T>>;
export function fromTsNode<T extends ts.Node>(
  original: T | ts.NodeArray<T>,
  _union: Union<T> | undefined,
): Node<T> {
  if (isNodeArray(original)) {
    return ListTemplateNode.fromTemplate(
      {
        match: (() => false) as any,
        load: (built: any) => built as ts.NodeArray<T>,
        // HACK ts.NodeArray<any> is not a ts.Node
        build: (children: T[]) => ts.createNodeArray(children) as any,
        flags: [],
        childUnion: _union!,
      },
      original,
      fromTsNode,
    ) as any;
  }
  if (_union) {
    const union = _union();
    if (Object.keys(union).length > 1) {
      return TemplateUnionNode.fromUnion(_union, original, fromTsNode);
    }
  }
  for (const template of stringTemplates) {
    if (template.match(original)) {
      return StringTemplateNode.fromTemplate(
        (template as any) as StringTemplate<T>,
        original,
      ) as any;
    }
  }
  for (const template of listTemplates) {
    if (template.match(original)) {
      return ListTemplateNode.fromTemplate(
        (template as any) as ListTemplate<T, ts.Node>,
        original,
        fromTsNode,
      ) as any;
    }
  }
  for (const template of structTemplates) {
    if (template.match(original)) {
      return StructTemplateNode.fromTemplate(
        (template as any) as StructTemplate<{}, T>,
        original,
        fromTsNode,
      ) as any;
    }
  }
  if (plainTypes.BooleanLiteral.match(original)) {
    return BooleanNode.fromTsNode(original) as any;
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
  links = [];
  private original: T;
  constructor(value: T) {
    super();
    this.original = value;
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
export class BooleanNode extends Node<ts.BooleanLiteral> {
  links = [];
  children = [];
  flags = {};
  original: ts.BooleanLiteral;
  actions: ActionSet<BooleanNode> = {
    toggle: {
      inputKind: InputKind.None,
      apply: () => new BooleanNode(!this.value, this.original),
    },
  };
  private value: boolean;
  constructor(value: boolean, original: ts.BooleanLiteral) {
    super();
    this.value = value;
    this.original = original;
  }
  setChild(child: never): never {
    throw new Error("BooleanNode can't have children");
  }
  setFlags(flags: never): never {
    throw new Error("BooleanNode can't have flags");
  }
  static fromTsNode(node: ts.BooleanLiteral): BooleanNode {
    return new BooleanNode(node.kind === ts.SyntaxKind.TrueKeyword, node);
  }
  setValue(value: UnionVariant<boolean>): BooleanNode {
    return new BooleanNode(value.key, this.original);
  }
  getDebugLabel() {
    return this.value.toString();
  }
  build(): BuildResult<ts.BooleanLiteral> {
    return this.buildHelper(() => ts.createLiteral(this.value));
  }
}
