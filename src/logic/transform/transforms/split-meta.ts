import * as R from "ramda";
import { Transform } from "..";
import { ActionSet } from "../../tree/action";
import { BuildResult, ChildNodeEntry, FlagSet, Node } from "../../tree/node";
import { compressChildrenTransform } from "./compress-useless-values";
import { ParentPathElement } from "../../parent-index";

export function isMetaBranchNode(
  node: Node<unknown>,
): node is MetaBranchNode<unknown> {
  return (
    node instanceof MetaBranchNode &&
    R.equals(
      node.children.map(c => c.key),
      ["primary", "meta"],
    )
  );
}

export const splitMetaTransform: Transform = node => {
  if (node instanceof MetaBranchNode || !node.metaSplit) {
    return node;
  }
  return MetaBranchNode.fromNode(node, node.metaSplit);
};

export interface MetaSplit {
  primaryChildren: string[];
  spreadPrimary?: boolean;
}

type NodeModification<B> = (node: Node<B>) => Node<B>;

interface ModifiedNode<B> {
  original: Node<B>;
  modifications: NodeModification<B>[];
}

class MetaBranchBranchNode<B> extends Node<ModifiedNode<B>> {
  children: ChildNodeEntry<unknown>[];
  flags: FlagSet;
  actions: ActionSet<Node<ModifiedNode<B>>>;

  constructor(
    private original: Node<B>,
    private modifications: NodeModification<B>[],
    private selectedChildren: string[],
    private spreadChildren: boolean,
    private idSuffix: string,
  ) {
    super();

    const modified = modifications.reduce(
      (node, modification) => modification(node),
      original,
    );
    this.id = modified.id + idSuffix;
    this.children = modified.children.filter(c =>
      this.selectedChildren.includes(c.key),
    );
    this.flags = modified.flags;
    this.actions = R.mapObjIndexed((action, key) => {
      if (!action) {
        return undefined;
      }
      return {
        ...action,
        apply: (...args: unknown[]) =>
          this.cloneAndModify([
            node => (node.actions[key] as any).apply(...args),
          ]),
      };
    }, modified.actions);

    if (this.spreadChildren) {
      return compressChildrenTransform(this) as any;
    }
  }

  private cloneAndModify(modifications: NodeModification<B>[]) {
    return new MetaBranchBranchNode(
      this.original,
      [...this.modifications, ...modifications],
      this.selectedChildren,
      this.spreadChildren,
      this.idSuffix,
    );
  }

  clone(): MetaBranchBranchNode<B> {
    return this.cloneAndModify([]);
  }

  setChild(child: ChildNodeEntry<unknown>): MetaBranchBranchNode<B> {
    return this.cloneAndModify([node => node.setChild(child)]);
  }

  setFlags(flags: FlagSet): MetaBranchBranchNode<B> {
    return this.cloneAndModify([node => node.setFlags(flags)]);
  }

  build(): BuildResult<ModifiedNode<B>> {
    return {
      ok: true,
      value: {
        original: this.original,
        modifications: this.modifications,
      },
    };
  }
}

export class MetaBranchNode<B> extends Node<B> {
  flags = {};
  actions = {};

  constructor(
    private original: Node<B>,
    private split: MetaSplit,
    public children: ChildNodeEntry<ModifiedNode<B>>[],
  ) {
    super();
  }

  static fromNode<B>(original: Node<B>, split: MetaSplit): MetaBranchNode<B> {
    const wrapped = new MetaBranchNode(
      original,
      split,
      ["primary", "meta"].map(branchKey => {
        const branchNode = new MetaBranchBranchNode(
          original,
          [],
          original.children
            .filter(c => {
              const isPrimary = split.primaryChildren.includes(c.key);
              return branchKey === "primary" ? isPrimary : !isPrimary;
            })
            .map(c => c.key),
          branchKey === "primary" && !!split.spreadPrimary,
          `-${branchKey}`,
        );
        return {
          key: branchKey,
          node: branchNode,
        };
      }),
    );
    wrapped.id = original.id;
    return wrapped;
  }

  private tryApplyModifications(): BuildResult<MetaBranchNode<B>> {
    const modifications: NodeModification<B>[] = [];
    for (const k of ["primary", "meta"]) {
      const child = this.children.find(c => c.key === k)!.node;
      const childBuildResult = child.build();
      if (!childBuildResult.ok) {
        return {
          ok: false,
          error: {
            ...childBuildResult.error,
            path: [k, ...childBuildResult.error.path],
          },
        };
      }
      modifications.push(...childBuildResult.value.modifications);
    }
    const modified = modifications.reduce(
      (node, modification) => modification(node),
      this.original,
    );
    return { ok: true, value: MetaBranchNode.fromNode(modified, this.split) };
  }

  clone(): MetaBranchNode<B> {
    const node = new MetaBranchNode(this.original, this.split, this.children);
    node.id = this.id;
    return node;
  }

  setChild(child: ChildNodeEntry<ModifiedNode<B>>): MetaBranchNode<B> {
    const node = this.clone();
    const i = node.children.findIndex(c => c.key === child.key);
    if (i < 0) {
      throw new Error(`invalid child key: ${child.key}`);
    }
    node.children = [...node.children];
    node.children[i] = child;

    const applyResult = node.tryApplyModifications();
    return applyResult.ok ? applyResult.value : node;
  }

  setFlags(flags: never): never {
    throw new Error("MetaBranchNode can't have flags");
  }

  unapplyTransform(): BuildResult<Node<B>> {
    const res = this.tryApplyModifications();
    return res.ok ? { ok: true, value: res.value.original } : res;
  }

  build(): BuildResult<B> {
    const res = this.unapplyTransform();
    return res.ok ? res.value.build() : res;
  }

  getDebugLabel() {
    return this.original.getDebugLabel();
  }

  getDisplayInfo(parentPath: ParentPathElement[]) {
    return this.original.getDisplayInfo(parentPath);
  }
}
