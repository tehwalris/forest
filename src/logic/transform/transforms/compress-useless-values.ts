import { Transform } from "..";
import {
  Node,
  ChildNodeEntry,
  FlagSet,
  BuildResult,
  DisplayInfo,
} from "../../tree/node";
import { ActionSet } from "../../tree/action";
import * as R from "ramda";
import { isMetaBranchNode } from "./split-meta";
import { ParentPathElement } from "../../parent-index";

type DisplaySelector<B> = (
  parentNode: Node<B>,
  childNode: Node<unknown>,
) => Node<unknown>[];

export const compressChildrenTransform: Transform = (node) => {
  if (node.children.length !== 1) {
    return node;
  }
  const child = node.children[0];
  if (
    R.intersection(Object.keys(node.actions), Object.keys(child.node.actions))
      .length ||
    R.intersection(Object.keys(node.flags), Object.keys(child.node.flags))
      .length ||
    node.metaSplit ||
    isMetaBranchNode(child.node)
  ) {
    return node;
  }
  const compressed = new CompressedNode(
    node,
    child.node,
    compressChildrenTransform,
  );
  compressed.id = node.id;
  return compressed;
};

export const compressUselessValuesTransform: Transform = (node) => {
  if (node.children.length !== 1) {
    return node;
  }
  const child = node.children[0];
  if (child.key !== "value") {
    return node;
  }
  return compressChildrenTransform(node);
};

export class CompressedNode<B> extends Node<B> {
  children: ChildNodeEntry<any>[];
  flags: FlagSet;
  actions: ActionSet<Node<B>>;

  constructor(
    private parentNode: Node<B>,
    private childNode: Node<unknown>,
    private reapplyTransform: Transform,
    private displaySelector: DisplaySelector<B> = (p, c) => [p, c],
  ) {
    super();
    this.children = childNode.children;
    this.flags = { ...parentNode.flags, ...childNode.flags };
    this.metaSplit = childNode.metaSplit;

    this.actions = {};
    for (const [k, a] of Object.entries(parentNode.actions)) {
      this.actions[k] = a && {
        ...a,
        apply: (...args: any[]) =>
          this.reapplyTransform((a.apply as any).call(a, ...args) as Node<B>),
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
      key: this.parentNode.children[0].key,
      node: childNode,
    });
    const resultNode = this.reapplyTransform(parentNode);
    resultNode.id = this.id;
    return resultNode;
  }

  clone(): CompressedNode<B> {
    const node = new CompressedNode(
      this.parentNode,
      this.childNode,
      this.reapplyTransform,
      this.displaySelector,
    );
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
      key: this.parentNode.children[0].key,
      node: this.childNode.setFlags(childFlags),
    }).setFlags(parentFlags);
  }

  private setParentFlags(flags: this["flags"]): Node<B> {
    const parentNode = this.parentNode.setFlags(flags);
    if (parentNode === this.parentNode) {
      return this;
    }
    const resultNode = this.reapplyTransform(parentNode);
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

  getDebugLabel(): string | undefined {
    return [...this.displaySelector(this.parentNode, this.childNode)]
      .reverse()
      .map((v) => v.getDebugLabel())
      .find((v) => v !== undefined);
  }

  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    return this.displaySelector(this.parentNode, this.childNode).reduce(
      (a: DisplayInfo | undefined, node) => {
        const c = node.getDisplayInfo(parentPath);
        if (!c || !a) {
          return c || a;
        }
        if (c.priority !== a.priority) {
          return c.priority > a.priority ? c : a;
        }
        return { ...a, label: [...a.label, ...c.label] };
      },
      undefined,
    );
  }
}
