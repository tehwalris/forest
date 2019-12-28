import { Transform } from "..";
import { Node, ChildNodeEntry, FlagSet, BuildResult } from "../../tree/node";
import { ActionSet } from "../../tree/action";
import { Link } from "../../tree/base";
import * as R from "ramda";

export const compressUselessValuesTransform: Transform = node => {
  if (node.children.length !== 1) {
    return node;
  }
  const child = node.children[0];
  if (
    child.key !== "value" ||
    R.intersection(Object.keys(node.actions), Object.keys(child.node.actions))
      .length ||
    R.intersection(Object.keys(node.flags), Object.keys(child.node.flags))
      .length ||
    Object.keys(child.node.links).length
  ) {
    return node;
  }
  const compressed = new CompressedNode(node, child.node);
  compressed.id = node.id;
  return compressed;
};

class CompressedNode<B> extends Node<B> {
  children: ChildNodeEntry<any>[];
  flags: FlagSet;
  actions: ActionSet<Node<B>>;
  links: Link[];

  constructor(private parentNode: Node<B>, private childNode: Node<unknown>) {
    super();
    this.children = childNode.children;
    this.flags = { ...parentNode.flags, ...childNode.flags };
    this.links = parentNode.links;

    this.actions = {};
    for (const [k, a] of Object.entries(parentNode.actions)) {
      this.actions[k] = a && {
        ...a,
        apply: (...args: any[]) =>
          compressUselessValuesTransform(
            (a.apply as any).call(a, ...args) as Node<B>,
          ),
      };
    }
    for (const [k, a] of Object.entries(childNode.actions)) {
      this.actions[k] = a && {
        ...a,
        apply: (...args: any[]) =>
          this.updateChildNode((a.apply as any).call(a, ...args) as Node<any>),
      };
    }
  }

  private updateChildNode(childNode: Node<unknown>): Node<B> {
    if (childNode === this.childNode) {
      return this;
    }
    const parentNode = this.parentNode.setChild({
      key: "value",
      node: childNode,
    });
    const resultNode = compressUselessValuesTransform(parentNode);
    resultNode.id = this.id;
    return resultNode;
  }

  clone(): CompressedNode<B> {
    const node = new CompressedNode(this.parentNode, this.childNode);
    node.id = this.id;
    return node;
  }

  setChild(child: ChildNodeEntry<unknown>): Node<B> {
    return this.updateChildNode(this.childNode.setChild(child));
  }

  setFlags(flags: this["flags"]): Node<B> {
    const parentFlags: this["flags"] = {};
    const childFlags: this["flags"] = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k in this.parentNode.flags) {
        (parentFlags as any)[k] = v;
      }
      if (k in this.childNode.flags) {
        (childFlags as any)[k] = v;
      }
    }
    let node: Node<B> = this;
    if (Object.keys(childFlags).length && node instanceof CompressedNode) {
      node = node.setChildFlags(childFlags);
    }
    if (Object.keys(parentFlags).length && node instanceof CompressedNode) {
      node = node.setParentFlags(parentFlags);
    }
    if (node instanceof CompressedNode) {
      return node;
    }
    return this.setChild({
      key: "value",
      node: this.childNode.setFlags(childFlags),
    }).setFlags(parentFlags);
  }

  private setParentFlags(flags: this["flags"]): Node<B> {
    const parentNode = this.parentNode.setFlags(flags);
    if (parentNode === this.parentNode) {
      return this;
    }
    const resultNode = compressUselessValuesTransform(parentNode);
    resultNode.id = this.id;
    return resultNode;
  }

  private setChildFlags(flags: this["flags"]): Node<B> {
    return this.updateChildNode(this.childNode.setFlags(flags));
  }

  build(): BuildResult<B> {
    return this.parentNode.build();
  }

  unapplyTransform(): BuildResult<Node<B>> {
    return { ok: true, value: this.parentNode };
  }
}
