type ChildNodeEntry<T> = any;
type ActionSet<T> = any;
type LazyUnionVariant<T> = any;
type UnionVariant<T> = any;

class Node<T> {}

export abstract class UnionNode<K, B> extends Node<B> {
  children: ChildNodeEntry<any>[];
  actions: ActionSet<Node<B>>;
  protected oneOf: LazyUnionVariant<K>[];
  protected value: UnionVariant<K>;
}
