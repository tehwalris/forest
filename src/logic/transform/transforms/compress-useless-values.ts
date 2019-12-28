import { Transform } from "..";
import { Node, ChildNodeEntry, FlagSet, BuildResult } from "../../tree/node";
import { ActionSet } from "../../tree/action";
import { Link } from "../../tree/base";

export const compressUselessValuesTransform: Transform = node => {
  if (node.children.length !== 1) {
    return node;
  }
  const child = node.children[0];
  if (
    child.key !== "value" ||
    Object.keys(child.node.flags).length ||
    Object.keys(child.node.actions).length ||
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
    this.flags = parentNode.flags;
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
  }

  clone(): CompressedNode<B> {
    const node = new CompressedNode(this.parentNode, this.childNode);
    node.id = this.id;
    return node;
  }

  setChild(child: ChildNodeEntry<unknown>): Node<B> {
    const childNode = this.childNode.setChild(child);
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

  setFlags(flags: this["flags"]): Node<B> {
    const parentNode = this.parentNode.setFlags(flags);
    if (parentNode === this.parentNode) {
      return this;
    }
    const resultNode = compressUselessValuesTransform(parentNode);
    resultNode.id = this.id;
    return resultNode;
  }

  build(): BuildResult<B> {
    return this.parentNode.build();
  }

  unapplyTransform(): BuildResult<Node<B>> {
    return { ok: true, value: this.parentNode };
  }
}
