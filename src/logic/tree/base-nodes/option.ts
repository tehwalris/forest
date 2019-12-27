import { UnionVariant } from "./union";
import { Node, BuildResult, ChildNodeEntry } from "../node";
import { ActionSet, InputKind } from "../action";
export class OptionNode<B> extends Node<B | undefined> {
  links = [] as never[];
  children: ChildNodeEntry<B>[];
  flags = {};
  actions: ActionSet<OptionNode<B>> = {
    toggle: {
      inputKind: InputKind.None,
      apply: () => {
        const node = new OptionNode(
          this.createInitialChild,
          this.children.length ? undefined : this.createInitialChild(),
        );
        node.id = this.id;
        return node;
      },
    },
  };
  private createInitialChild: () => Node<B>;
  constructor(createInitialChild: () => Node<B>, currentChild?: Node<B>) {
    super();
    this.createInitialChild = createInitialChild;
    this.children = currentChild ? [{ key: "value", node: currentChild }] : [];
  }
  clone(): OptionNode<B> {
    const node = new OptionNode(this.createInitialChild, undefined);
    node.children = [...this.children];
    return node;
  }
  setChild(child: ChildNodeEntry<B>): OptionNode<B> {
    if (child.key === "value") {
      const node = new OptionNode(this.createInitialChild, child.node);
      node.id = this.id;
      return node;
    }
    throw new Error('OptionNode only supports "value" child.');
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  setValue(value: UnionVariant<boolean>): OptionNode<B> {
    const node = new OptionNode(
      this.createInitialChild,
      value.key ? value.children[0].node : undefined,
    );
    node.id = this.id;
    return node;
  }
  getDebugLabel() {
    return `Option<${this.children.length ? "Some" : "None"}>`;
  }
  get original(): B | undefined {
    const child = this.children[0];
    return child && (child.node as any).original;
  }
  build(): BuildResult<B | undefined> {
    return this.children.length
      ? this.buildHelper(({ value }) => value)
      : { ok: true, value: undefined };
  }
}
