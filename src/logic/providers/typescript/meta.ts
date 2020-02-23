import { Node, ChildNodeEntry, BuildResult, FlagSet } from "../../tree/node";
import { ActionSet } from "../../tree/action";
import { Link } from "../../tree/base";
import * as R from "ramda";

interface MetaSplit {
  primaryChildren: string[];
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
  links: Link[];

  constructor(
    private original: Node<B>,
    private modifications: NodeModification<B>[],
    private selectedChildren: string[],
  ) {
    super();

    const modified = modifications.reduce(
      (node, modification) => modification(node),
      original,
    );
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
    this.links = modified.links;
  }

  private cloneAndModify(modifications: NodeModification<B>[]) {
    const node = new MetaBranchBranchNode(
      this.original,
      [...this.modifications, ...modifications],
      this.selectedChildren,
    );
    node.id = this.id;
    return node;
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
  links = [];

  constructor(
    private original: Node<B>,
    private split: MetaSplit,
    public children: ChildNodeEntry<ModifiedNode<B>>[],
  ) {
    super();
  }

  fromNode(original: Node<B>, split: MetaSplit): MetaBranchNode<B> {
    return new MetaBranchNode(
      original,
      split,
      ["primary", "meta"].map(branchKey => ({
        key: branchKey,
        node: new MetaBranchBranchNode(
          original,
          [],
          this.children
            .filter(c => {
              const isPrimary = split.primaryChildren.includes(c.key);
              return branchKey === "primary" ? isPrimary : !isPrimary;
            })
            .map(c => c.key),
        ),
      })),
    );
  }

  private tryApplyModifications(): MetaBranchNode<B> {
    const modifications: NodeModification<B>[] = [];
    for (const k of ["primary", "meta"]) {
      const child = this.children.find(c => c.key === k)!.node;
      const childBuildResult = child.build();
      if (!childBuildResult.ok) {
        return this;
      }
      modifications.push(...childBuildResult.value.modifications);
    }
    const modified = modifications.reduce(
      (node, modification) => modification(node),
      this.original,
    );
    const node = this.fromNode(modified, this.split);
    node.id = this.id;
    return node;
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
    return node.tryApplyModifications();
  }

  setFlags(flags: never): never {
    throw new Error("MetaBranchNode can't have flags");
  }

  build(): BuildResult<B> {
    return this.original.build();
  }
}
