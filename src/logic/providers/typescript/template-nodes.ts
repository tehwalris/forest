import { Enchancer } from "./enchancer";
import { ListNode, OptionNode, UnionNode } from "../../tree/base-nodes";
import * as ts from "typescript";
import {
  Node,
  ChildNodeEntry,
  BuildResult,
  FlagSet,
  DisplayInfo,
  DisplayInfoPriority,
  LabelStyle,
} from "../../tree/node";
import { ActionSet, InputKind } from "../../tree/action";
import { UnionVariant, LazyUnionVariant } from "../../tree/base-nodes/union";
import {
  FlagKind,
  loadFlags,
  flagsToModifiers,
  saveNodeFlagsMutate,
} from "./flags";
import { shortcutsByType } from "./generated/templates";
import { fromTsNode } from "./convert";
import { MetaSplit } from "../../transform/transforms/split-meta";
import { ParentPathElement } from "../../parent-index";
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
  enchancer?: Enchancer<Node<B>>;
}
export interface ListTemplate<B extends ts.Node, C extends ts.Node>
  extends Template<B> {
  load: (built: B) => ts.NodeArray<C>;
  build: (children: C[], modifiers: ts.Modifier[]) => B;
  flags: FlagKind[];
  childUnion: Union<C>;
  enchancer?: Enchancer<Node<any>>;
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
    modifiers: ts.Modifier[],
  ) => B;
  flags: FlagKind[];
  children: string[];
  metaSplit?: MetaSplit;
  enchancer?: Enchancer<Node<B>>;
}
function someDefaultFromUnion<T extends ts.Node>(
  _union: Union<T>,
  self: ts.Node,
): T {
  const union = _union();
  return union[Object.keys(union)[0]].default;
}
export class StringTemplateNode<B extends ts.Node> extends Node<B> {
  children: never[] = [];
  flags = {};
  actions: ActionSet<StringTemplateNode<B>> = {
    setFromString: {
      inputKind: InputKind.String,
      apply: v => {
        const node = new StringTemplateNode(this.template, v, this.original);
        node.id = this.id;
        return node;
      },
    },
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
  clone(): StringTemplateNode<B> {
    const node = new StringTemplateNode(
      this.template,
      this.text,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  static fromTemplate<B extends ts.Node>(
    template: StringTemplate<B>,
    node: B,
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
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    const { enchancer } = this.template;
    const infoFromEnchancer = enchancer?.(this, parentPath).displayInfo;
    const label = (infoFromEnchancer?.label || []).map(e => {
      if (e.style === LabelStyle.VALUE && e.text === "") {
        return { text: this.text, style: LabelStyle.VALUE };
      }
      return e;
    });
    if (!label?.length) {
      label?.push({ text: this.text, style: LabelStyle.VALUE });
    }
    return {
      priority: DisplayInfoPriority.LOW,
      ...infoFromEnchancer,
      label,
    };
  }
}
export class ListTemplateNode<
  B extends ts.Node,
  C extends ts.Node
> extends ListNode<C, B> {
  // children: ChildNodeEntry<C>[]; // HACK This field should use "declare", but that's not supported in CRA at the moment
  constructor(
    private template: ListTemplate<B, C>,
    private newChild: () => Node<C>,
    private rawChildren: Node<C>[],
    public flags: FlagSet,
    public original: B,
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
    fromTsNode: (tsNode: C, union: Union<C>) => Node<C>,
  ): ListTemplateNode<B, C> {
    return new ListTemplateNode(
      template,
      () =>
        fromTsNode(
          someDefaultFromUnion(template.childUnion, node),
          template.childUnion,
        ),
      template.load(node).map(e => fromTsNode(e, template.childUnion)),
      loadFlags(node, template.flags),
      node,
    );
  }
  clone(): ListTemplateNode<B, C> {
    return this.setValue(this.rawChildren);
  }
  protected setValue(children: Node<C>[]): ListTemplateNode<B, C> {
    const node = new ListTemplateNode(
      this.template,
      this.newChild,
      children,
      this.flags,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  setFlags(flags: this["flags"]): ListTemplateNode<B, C> {
    const node = new ListTemplateNode(
      this.template,
      this.newChild,
      this.rawChildren,
      flags,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  createChild(): Node<C> {
    return this.newChild();
  }
  build(): BuildResult<B> {
    return this.listBuildHelper(builtChildren => {
      const node = this.template.build(
        builtChildren,
        flagsToModifiers(this.flags),
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    const { enchancer } = this.template;
    return enchancer ? enchancer(this, parentPath).displayInfo : undefined;
  }
}
export class StructTemplateNode<
  C extends {
    [key: string]: StructChild<ts.Node>;
  },
  B extends ts.Node
> extends Node<B> {
  actions: ActionSet<never> = {};
  constructor(
    private template: StructTemplate<C, B>,
    public children: ChildNodeEntry<B[keyof B]>[],
    public flags: FlagSet,
    public original: B,
  ) {
    super();
    this.template = template;
    this.children = children;
    this.flags = flags;
    this.original = original;
    this.metaSplit = template.metaSplit;
  }
  clone(): StructTemplateNode<C, B> {
    const node = new StructTemplateNode(
      this.template,
      this.children,
      this.flags,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  static fromTemplate<
    C extends {
      [key: string]: StructChild<ts.Node>;
    },
    B extends ts.Node
  >(
    template: StructTemplate<C, B>,
    node: B,
    fromTsNode: <CT extends ts.Node>(tsNode: CT, union: Union<CT>) => Node<CT>,
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
            childValue && fromTsNode(childValue, loadedChild.union),
          ),
        };
      }
      return { key, node: fromTsNode(childValue, loadedChild.union) };
    });
    return new StructTemplateNode(
      template,
      children,
      loadFlags(node, template.flags),
      node,
    );
  }
  setChild<CK extends keyof C>(
    child: ChildNodeEntry<{}> & {
      key: CK;
    },
  ): StructTemplateNode<C, B> {
    let didReplace = false;
    const children = this.children.map(e => {
      if (e.key === child.key) {
        didReplace = true;
        return child as any;
      }
      return e;
    });
    if (!didReplace) {
      throw new Error(`Unsupported child ${child.key}`);
    }
    const node = new StructTemplateNode(
      this.template,
      children,
      this.flags,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  setFlags(flags: this["flags"]): StructTemplateNode<C, B> {
    const node = new StructTemplateNode(
      this.template,
      this.children,
      flags,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  build(): BuildResult<B> {
    return this.buildHelper(builtChildren => {
      const node = this.template.build(
        builtChildren as { [CK in keyof C]: C[CK]["value"] },
        flagsToModifiers(this.flags),
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    const { enchancer } = this.template;
    return enchancer ? enchancer(this, parentPath).displayInfo : undefined;
  }
}
export class TemplateUnionNode<T extends ts.Node> extends UnionNode<string, T> {
  flags = {};
  constructor(
    private _union: Union<T>,
    private variants: LazyUnionVariant<string>[],
    value: UnionVariant<string>,
    public original: T,
  ) {
    super(variants, value);
    this.actions.replace = {
      inputKind: InputKind.Node,
      apply: inputNode => {
        const buildResult = inputNode.build();
        if (!buildResult.ok) {
          return this;
        }
        const tsNode = buildResult.value as ts.Node;
        if (!Object.values(this._union()).some(e => e.match(tsNode))) {
          return this;
        }
        return fromTsNode(tsNode, this._union);
      },
    };
  }
  clone(): TemplateUnionNode<T> {
    const node = new TemplateUnionNode(
      this._union,
      this.variants,
      this.value,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  static fromUnion<T extends ts.Node>(
    _union: Union<T>,
    node: T,
    fromTsNode: <CT extends ts.Node>(tsNode: CT) => Node<CT>,
  ): TemplateUnionNode<T> {
    const union = _union();
    const variants = Object.keys(union).map(key => ({
      key,
      children: () => [{ key: "value", node: fromTsNode(union[key].default) }],
    }));
    let currentKey = Object.keys(union).find(k => union[k].match(node));
    if (!currentKey) {
      const label = ts.SyntaxKind[node.kind];
      console.warn(`Missing key for ${label}.`);
      currentKey = `<missing: ${label}>`;
    }
    return new TemplateUnionNode(
      _union,
      variants,
      { key: currentKey, children: [{ key: "value", node: fromTsNode(node) }] },
      node,
    );
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  setValue(value: UnionVariant<string>): TemplateUnionNode<T> {
    const node = new TemplateUnionNode(
      this._union,
      this.variants,
      value,
      this.original,
    );
    node.id = this.id;
    return node;
  }
  getLabel(key: string): string {
    return key;
  }
  getShortcut(key: string): string | undefined {
    return shortcutsByType.get(key);
  }
  getDebugLabel(): string {
    return this.getLabel(this.value.key);
  }
  build(): BuildResult<T> {
    return this.buildHelper(({ value }) => value);
  }
}
