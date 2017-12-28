import { Enchancer } from "./enchancer";
import { ListNode, OptionNode, UnionNode } from "../../tree/base-nodes";
import * as ts from "typescript";
import {
  Node,
  ChildNodeEntry,
  BuildResult,
  FlagSet,
  DisplayInfo
} from "../../tree/node";
import { ActionSet, InputKind } from "../../tree/action";
import { UnionVariant, LazyUnionVariant } from "../../tree/base-nodes/union";
import {
  FlagKind,
  loadFlags,
  flagsToModifiers,
  saveNodeFlagsMutate
} from "./flags";
export type Union<T extends ts.Node> = () => {
  [key: string]: {
    match: (node: ts.Node) => node is T;
    default: T;
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
}
export interface OptionalStructSingleChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: T | undefined;
  optional: true;
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
type StructChild<T extends ts.Node> =
  | RequiredStructSingleChild<T>
  | OptionalStructSingleChild<T>
  | RequiredStructListChild<T>
  | OptionalStructListChild<T>;
export interface StructTemplate<
  C extends {
    [key: string]: StructChild<ts.Node>;
  },
  B extends ts.Node
> extends Template<B> {
  load: (built: B) => C;
  build: (
    children: { [CK in keyof C]: C[CK]["value"] },
    modifiers: ts.Modifier[]
  ) => B;
  flags: FlagKind[];
  children: (keyof C)[];
  enchancer?: Enchancer<Node<B>>;
}
function someDefaultFromUnion<T extends ts.Node>(
  _union: Union<T>,
  self: ts.Node
): T {
  const union = _union();
  return union[Object.keys(union)[0]].default;
}
export class StringTemplateNode<B extends ts.Node> extends Node<B> {
  children: never[] = [];
  flags = {};
  links: never[] = [];
  actions: ActionSet<StringTemplateNode<B>> = {
    setFromString: {
      inputKind: InputKind.String,
      apply: v => new StringTemplateNode(this.template, v, this.original)
    }
  };
  private template: StringTemplate<B>;
  private text: string;
  original: B;
  constructor(template: StringTemplate<B>, text: string, original: B) {
    super();
    this.template = template;
    this.text = text;
    this.original = original;
  }
  static fromTemplate<B extends ts.Node>(
    template: StringTemplate<B>,
    node: B
  ): StringTemplateNode<B> {
    return new StringTemplateNode(template, template.load(node), node);
  }
  setChild(child: never): never {
    throw new Error("Children not supported");
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  getDebugLabel() {
    return this.text;
  }
  build(): BuildResult<B> {
    return this.buildHelper(() => this.template.build(this.text));
  }
}
export class ListTemplateNode<
  B extends ts.Node,
  C extends ts.Node
> extends ListNode<C, B> {
  children: ChildNodeEntry<C>[];
  links = [] as never[];
  constructor(
    private template: ListTemplate<B, C>,
    private newChild: () => Node<C>,
    private rawChildren: Node<C>[],
    public flags: FlagSet,
    public original: B
  ) {
    super(rawChildren);
    this.template = template;
    this.newChild = newChild;
    this.rawChildren = rawChildren;
    this.flags = flags;
    this.original = original;
  }
  static fromTemplate<B extends ts.Node, C extends ts.Node>(
    template: ListTemplate<B, C>,
    node: B,
    fromTsNode: (tsNode: C, union: Union<C>) => Node<C>
  ): ListTemplateNode<B, C> {
    return new ListTemplateNode(
      template,
      () =>
        fromTsNode(
          someDefaultFromUnion(template.childUnion, node),
          template.childUnion
        ),
      template.load(node).map(e => fromTsNode(e, template.childUnion)),
      loadFlags(node, template.flags),
      node
    );
  }
  protected setValue(children: Node<C>[]): ListTemplateNode<B, C> {
    return new ListTemplateNode(
      this.template,
      this.newChild,
      children,
      this.flags,
      this.original
    );
  }
  setFlags(flags: this["flags"]): ListTemplateNode<B, C> {
    return new ListTemplateNode(
      this.template,
      this.newChild,
      this.rawChildren,
      flags,
      this.original
    );
  }
  createChild(): Node<C> {
    return this.newChild();
  }
  build(): BuildResult<B> {
    return this.listBuildHelper(builtChildren => {
      const node = this.template.build(
        builtChildren,
        flagsToModifiers(this.flags)
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
}
export class StructTemplateNode<
  C extends {
    [key: string]: StructChild<ts.Node>;
  },
  B extends ts.Node
> extends Node<B> {
  links = [] as never[];
  actions: ActionSet<never> = {};
  constructor(
    private template: StructTemplate<C, B>,
    public children: ChildNodeEntry<B[keyof B]>[],
    public flags: FlagSet,
    public original: B
  ) {
    super();
    this.template = template;
    this.children = children;
    this.flags = flags;
    this.original = original;
  }
  static fromTemplate<
    C extends {
      [key: string]: StructChild<ts.Node>;
    },
    B extends ts.Node
  >(
    template: StructTemplate<C, B>,
    node: B,
    fromTsNode: <CT extends ts.Node>(tsNode: CT, union: Union<CT>) => Node<CT>
  ): StructTemplateNode<C, B> {
    const loaded = template.load(node);
    const children = template.children.map(key => {
      const loadedChild: StructChild<any> = loaded[key];
      const childValue = loadedChild.value;
      if (loadedChild.optional) {
        const defaultValue = (loadedChild as any).isList
          ? []
          : someDefaultFromUnion(loadedChild.union, node);
        return {
          key,
          node: new OptionNode(
            () => fromTsNode(defaultValue, loadedChild.union),
            childValue && fromTsNode(childValue, loadedChild.union)
          )
        };
      }
      return { key, node: fromTsNode(childValue, loadedChild.union) };
    });
    return new StructTemplateNode(
      template,
      children,
      loadFlags(node, template.flags),
      node
    );
  }
  setChild<CK extends keyof C>(
    child: ChildNodeEntry<{}> & {
      key: CK;
    }
  ): StructTemplateNode<C, B> {
    let didReplace = false;
    const children = this.children.map(e => {
      if (e.key === child.key) {
        didReplace = true;
        return child;
      }
      return e;
    });
    if (!didReplace) {
      throw new Error(`Unsupported child ${child.key}`);
    }
    return new StructTemplateNode(
      this.template,
      children,
      this.flags,
      this.original
    );
  }
  setFlags(flags: this["flags"]): StructTemplateNode<C, B> {
    return new StructTemplateNode(
      this.template,
      this.children,
      flags,
      this.original
    );
  }
  build(): BuildResult<B> {
    return this.buildHelper(builtChildren => {
      const node = this.template.build(
        builtChildren as { [CK in keyof C]: C[CK]["value"] },
        flagsToModifiers(this.flags)
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
  getDisplayInfo(): DisplayInfo | undefined {
    const { enchancer } = this.template;
    return enchancer ? enchancer(this).displayInfo : undefined;
  }
}
export class TemplateUnionNode<T extends ts.Node> extends UnionNode<string, T> {
  flags = {};
  links: never[] = [];
  private variants: LazyUnionVariant<string>[];
  original: T;
  constructor(
    variants: LazyUnionVariant<string>[],
    value: UnionVariant<string>,
    original: T
  ) {
    super(variants, value);
    this.variants = variants;
    this.original = original;
  }
  static fromUnion<T extends ts.Node>(
    _union: Union<T>,
    node: T,
    fromTsNode: <CT extends ts.Node>(tsNode: CT) => Node<CT>
  ): TemplateUnionNode<T> {
    const union = _union();
    const variants = Object.keys(union).map(key => ({
      key,
      children: () => [{ key: "value", node: fromTsNode(union[key].default) }]
    }));
    let currentKey = Object.keys(union).find(k => union[k].match(node));
    if (!currentKey) {
      const label = ts.SyntaxKind[node.kind];
      console.warn(`Missing key for ${label}.`);
      currentKey = `<missing: ${label}>`;
    }
    return new TemplateUnionNode(
      variants,
      { key: currentKey, children: [{ key: "value", node: fromTsNode(node) }] },
      node
    );
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  setValue(value: UnionVariant<string>): TemplateUnionNode<T> {
    return new TemplateUnionNode(this.variants, value, this.original);
  }
  getLabel(key: string): string {
    return key;
  }
  getDebugLabel(): string {
    return this.getLabel(this.value.key);
  }
  build(): BuildResult<T> {
    return this.buildHelper(({ value }) => value);
  }
}
