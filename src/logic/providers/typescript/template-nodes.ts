import { Enhancer } from "./enhancer";
import { EmptyLeafNode, ListNode, UnionNode } from "../../tree/base-nodes";
import * as ts from "typescript";
import {
  Node,
  ChildNodeEntry,
  BuildResult,
  FlagSet,
  DisplayInfo,
  DisplayInfoPriority,
  LabelStyle,
  BuildDivetreeDisplayTreeArgs,
  LabelPart,
  SemanticColor,
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
import { ParentPathElement } from "../../parent-index";
import { Doc, leafDoc } from "../../tree/display-line";
import { NodeKind } from "divetree-core";
import { arrayFromTextSize } from "../../text-measurement";
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
  enhancer?: Enhancer<Node<B>>;
}
export interface ListTemplate<B extends ts.Node, C extends ts.Node>
  extends Template<B> {
  load: (built: B) => ts.NodeArray<C>;
  build: (children: C[], modifiers: ts.Modifier[]) => B;
  flags: FlagKind[];
  childUnion: Union<C>;
  enhancer?: Enhancer<Node<any>>;
}
interface BaseStructChild<T extends ts.Node> {
  union: Union<T>;
}
export interface RequiredStructSingleChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: T;
  optional?: never;
  isList?: never;
  enhancer?: never;
}
export interface OptionalStructSingleChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: T | undefined;
  optional: true;
  isList?: never;
  enhancer?: never;
}
export interface RequiredStructListChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: ts.NodeArray<T>;
  optional?: never;
  isList: true;
  enhancer?: Enhancer<Node<ts.NodeArray<T>>>;
}
export interface OptionalStructListChild<T extends ts.Node>
  extends BaseStructChild<T> {
  value: ts.NodeArray<T> | undefined;
  optional: true;
  isList: true;
  enhancer?: Enhancer<Node<ts.NodeArray<T>>>;
}
type StructChild<T extends ts.Node> =
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
  enhancer?: Enhancer<Node<B>>;
}
function someDefaultFromUnion<T extends ts.Node>(
  _union: Union<T>,
  self: ts.Node,
): T {
  const union = _union.getMembers();
  return union[Object.keys(union)[0]].default;
}
export class StringTemplateNode<B extends ts.Node> extends Node<B> {
  children: never[] = [];
  flags = {};
  actions: ActionSet<StringTemplateNode<B>> = {
    setFromString: {
      inputKind: InputKind.String,
      apply: (v) => {
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
    const { enhancer } = this.template;
    const infoFromEnhancer = enhancer?.(this, parentPath).displayInfo;
    const label = (infoFromEnhancer?.label || []).map((e) => {
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
      ...infoFromEnhancer,
      label,
    };
  }
  buildDoc(args: BuildDivetreeDisplayTreeArgs): Doc | undefined {
    return this.template.enhancer?.(this, args.parentPath).buildDoc?.(args);
  }
}
export class ListTemplateNode<
  B extends ts.Node,
  C extends ts.Node,
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
        RequiredHoleNode.tryWrap(
          fromTsNode(
            someDefaultFromUnion(template.childUnion, node),
            template.childUnion,
          ),
        ),
      template.load(node).map((e) => fromTsNode(e, template.childUnion)),
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
    return this.listBuildHelper((builtChildren) => {
      const node = this.template.build(
        builtChildren,
        flagsToModifiers(this.flags),
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
  getDebugLabel(): string | undefined {
    return this.children.length ? undefined : "Empty list";
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    const { enhancer } = this.template;
    return enhancer ? enhancer(this, parentPath).displayInfo : undefined;
  }
  buildDoc(args: BuildDivetreeDisplayTreeArgs): Doc | undefined {
    return this.template.enhancer?.(this, args.parentPath).buildDoc?.(args);
  }
}
export class StructTemplateNode<
  C extends {
    [key: string]: StructChild<ts.Node>;
  },
  B extends ts.Node,
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
    B extends ts.Node,
  >(
    template: StructTemplate<C, B>,
    node: B,
    fromTsNode: <CT extends ts.Node | undefined>(
      tsNode: CT,
      union: Union<CT>,
      listEnhancer?: Enhancer<Node<ts.NodeArray<NonNullable<CT>>>>,
    ) => Node<CT>,
  ): StructTemplateNode<C, B> {
    const loaded = template.load(node);
    const children = template.children.map((key) => {
      const loadedChild: StructChild<any> = loaded[key];
      const childValue = loadedChild.value;
      if (loadedChild.optional) {
        if (loadedChild.isList) {
          return {
            key,
            node: fromTsNode(
              childValue ?? [],
              loadedChild.union,
              loadedChild.enhancer,
            ),
          };
        } else {
          return {
            key,
            node: fromTsNode(
              childValue || undefined,
              {
                name: loadedChild.union.name,
                getMembers: () => ({
                  ...loadedChild.union.getMembers(),
                  "Option<None>": {
                    match: (v): v is undefined => v === undefined,
                    default: undefined,
                  },
                }),
              },
              loadedChild.enhancer,
            ),
          };
        }
      }
      return {
        key,
        node: fromTsNode(childValue, loadedChild.union, loadedChild.enhancer),
      };
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
    const children = this.children.map((e) => {
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
    return this.buildHelper((builtChildren) => {
      const node = this.template.build(
        builtChildren as { [CK in keyof C]: C[CK]["value"] },
        flagsToModifiers(this.flags),
      );
      saveNodeFlagsMutate(node, this.flags);
      return node;
    });
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    const { enhancer } = this.template;
    return enhancer ? enhancer(this, parentPath).displayInfo : undefined;
  }
  buildDoc(args: BuildDivetreeDisplayTreeArgs): Doc | undefined {
    return this.template.enhancer?.(this, args.parentPath).buildDoc?.(args);
  }
}
export class TemplateUnionNode<T extends ts.Node | undefined> extends UnionNode<
  string,
  T
> {
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
      apply: (inputNode) => {
        const buildResult = inputNode.build();
        if (!buildResult.ok) {
          return this;
        }
        const tsNode = buildResult.value as ts.Node | undefined;
        if (
          !Object.values(this._union.getMembers()).some((e) => e.match(tsNode))
        ) {
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
  static fromUnion<T extends ts.Node | undefined>(
    _union: Union<T>,
    node: T,
    _fromTsNode: <CT extends ts.Node>(tsNode: CT) => Node<CT>,
  ): TemplateUnionNode<T> {
    const fromTsNode = <CT extends ts.Node>(node: CT | undefined) =>
      node === undefined
        ? new EmptyLeafNode("Option<None>")
        : _fromTsNode(node);

    const union = _union.getMembers();
    const variants = Object.keys(union).map((key) => ({
      key,
      children: () => [{ key: "value", node: fromTsNode(union[key].default) }],
    }));
    let currentKey = Object.keys(union).find((k) => union[k].match(node));
    if (!currentKey) {
      const label =
        node === undefined ? "Option<None>" : ts.SyntaxKind[node.kind];
      console.warn(`Missing key for ${label}.`);
      currentKey = `<missing: ${label}>`;
    }
    return new TemplateUnionNode(
      _union,
      variants,
      {
        key: currentKey,
        children: [{ key: "value", node: fromTsNode(node) }],
      },
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
    if (key === "Option<None>") {
      return "";
    }
    return shortcutsByType.get(key);
  }
  getDebugLabel(): string {
    return this.getLabel(this.value.key);
  }
  getUnionName(): string {
    return this._union.name;
  }
  build(): BuildResult<T> {
    return this.buildHelper(({ value }) => value);
  }
}
export class RequiredHoleNode<B> extends Node<B> {
  children: ChildNodeEntry<any>[] = [];
  actions: ActionSet<Node<B>> = {};
  flags = {};
  constructor(private inner: Node<B>) {
    super();
    if (!RequiredHoleNode.isValidInnerNode(inner)) {
      throw new Error("invalid inner node");
    }
    this.actions.setVariant = inner.actions.setVariant;
    this.actions.replace = inner.actions.replace;
  }
  static tryWrap<B>(inner: Node<B>): Node<B> {
    return this.isValidInnerNode(inner) ? new RequiredHoleNode(inner) : inner;
  }
  private static isValidInnerNode<B>(inner: Node<B>): boolean {
    return !!inner.actions.setVariant;
  }
  clone(): RequiredHoleNode<B> {
    return new RequiredHoleNode(this.inner);
  }
  setChild(newChild: ChildNodeEntry<any>): RequiredHoleNode<B> {
    throw new Error("RequiredHoleNode can't have children");
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  getDebugLabel(): string | undefined {
    if (this.inner instanceof TemplateUnionNode) {
      return this.inner.getUnionName();
    }
    return "Required hole";
  }
  private getLabel(): LabelPart[] {
    return [{ text: this.getDebugLabel() || "", style: LabelStyle.VALUE }];
  }
  getDisplayInfo(): DisplayInfo {
    return {
      label: this.getLabel(),
      priority: DisplayInfoPriority.MEDIUM,
      color: SemanticColor.HOLE,
    };
  }
  build(): BuildResult<B> {
    return this.buildHelper(() => {
      throw new Error("RequiredHoleNode must be filled using setVariant");
    });
  }
  buildDoc({
    nodeForDisplay,
    measureLabel,
  }: BuildDivetreeDisplayTreeArgs): Doc | undefined {
    return leafDoc({
      kind: NodeKind.TightLeaf,
      id: nodeForDisplay.id,
      size: arrayFromTextSize(measureLabel(this.getLabel())),
    });
  }
}
