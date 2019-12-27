import { ActionSet, InputKind } from "../action";
import { Node, ChildNodeEntry, BuildResult } from "../node";
import { Link } from "../base";
export abstract class ListNode<T, B> extends Node<B> {
  children: ChildNodeEntry<T>[];
  actions: ActionSet<ListNode<T, B>>;
  protected value: Node<T>[];
  abstract links: Link[];
  constructor(value: Node<T>[]) {
    super();
    this.value = value;
    this.children = value.map((e, i) => ({ key: `${i}`, node: e }));
    this.actions = {
      prepend: {
        inputKind: InputKind.None,
        apply: () =>
          this.setValue([
            this.createChild(),
            ...this.children.map(e => e.node),
          ]),
      },
      append: {
        inputKind: InputKind.None,
        apply: () =>
          this.setValue([
            ...this.children.map(e => e.node),
            this.createChild(),
          ]),
      },
      deleteChild: {
        inputKind: InputKind.Child,
        apply: k =>
          this.setValue(
            this.children.filter(e => e.key !== k).map(e => e.node),
          ),
      },
    };
  }
  setChild(newChild: ChildNodeEntry<T>): ListNode<T, B> {
    const newValue = [...this.value];
    newValue[+newChild.key] = newChild.node;
    return this.setValue(newValue);
  }
  listBuildHelper(cb: (children: T[]) => B): BuildResult<B> {
    return this.buildHelper(children =>
      cb(Object.keys(children).map((e, i) => children[`${i}`])),
    );
  }
  protected abstract setValue(value: Node<T>[]): ListNode<T, B>;
  protected abstract createChild(): Node<T>;
  abstract build(): BuildResult<B>;
}
