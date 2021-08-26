import { ActionSet, InputKind } from "../action";
import { Node, ChildNodeEntry, BuildResult } from "../node";
export abstract class UnionNode<K, B> extends Node<B> {
  children: ChildNodeEntry<any>[];
  actions: ActionSet<Node<B>>;
  protected oneOf: LazyUnionVariant<K>[];
  protected value: UnionVariant<K>;
  constructor(oneOf: LazyUnionVariant<K>[], value: UnionVariant<K>) {
    super();
    this.oneOf = oneOf;
    this.value = value;
    this.children = this.value.children;
    this.actions = {
      setVariant: {
        inputKind: InputKind.OneOf,
        oneOf: this.oneOf.map((e) => e.key),
        getLabel: this.getLabel.bind(this),
        getShortcut: this.getShortcut.bind(this),
        apply: (input: K): UnionNode<K, B> => {
          const newValue = this.oneOf.find((e) => e.key === input);
          if (!newValue) {
            throw new Error("Invalid union variant key");
          }
          return this.setValue({ ...newValue, children: newValue.children() });
        },
      },
    };
  }
  setChild(newChild: ChildNodeEntry<any>): UnionNode<K, B> {
    return this.setValue({
      ...this.value,
      children: this.value.children.map((c) => {
        if (c.key === newChild.key) {
          return newChild;
        }
        return c;
      }),
    });
  }
  protected abstract setValue(value: UnionVariant<K>): UnionNode<K, B>;
  protected abstract getLabel(key: K): string;
  protected getShortcut(key: K): string | undefined {
    return undefined;
  }
  abstract build(): BuildResult<B>;
}
export interface LazyUnionVariant<K> {
  key: K;
  children: () => ChildNodeEntry<any>[];
}
export interface UnionVariant<K> {
  key: K;
  children: ChildNodeEntry<any>[];
}
