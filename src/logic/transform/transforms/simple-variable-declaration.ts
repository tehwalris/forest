import { Node, ChildNodeEntry, FlagSet, BuildResult } from "../../tree/node";
import { Transform } from "..";
import * as R from "ramda";
import { ActionSet } from "../../tree/action";
import { Link } from "../../tree/base";

// HACK There should be a better way to get the type of a node
function isVariableStatement(node: Node<unknown>): boolean {
  return R.equals(
    node.children.map(c => c.key),
    ["declarationList"],
  );
}

export const simpleVariableDeclarationTransfrom: Transform = node => {
  if (!isVariableStatement(node)) {
    return node;
  }
  const declarationListNode = node.getByPath(["declarationList"]);
  if (declarationListNode?.children.length !== 1) {
    return node;
  }
  const onlyChildEntry = declarationListNode.children[0];
  const initializerNode = onlyChildEntry.node.getByPath(["initializer"]);
  if (!initializerNode?.actions.toggle) {
    return node;
  }
  return node.setDeepChild(
    ["declarationList", onlyChildEntry.key, "initializer"],
    new ActionMaskedNode(initializerNode, ["toggle"]),
  );
};

class ActionMaskedNode<B> extends Node<B> {
  children: ChildNodeEntry<unknown>[];
  flags: FlagSet;
  actions: ActionSet<Node<B>>;
  links: Link[];

  constructor(
    private baseNode: Node<B>,
    private omitActions: (keyof ActionSet<Node<B>> & string)[],
  ) {
    super();
    this.id = baseNode.id;
    this.children = baseNode.children;
    this.metaSplit = baseNode.metaSplit;
    this.flags = baseNode.flags;
    this.actions = R.omit(omitActions, baseNode.actions);
    this.links = baseNode.links;
  }

  clone(): ActionMaskedNode<B> {
    return new ActionMaskedNode(this.baseNode, this.omitActions);
  }

  setChild(child: ChildNodeEntry<unknown>): ActionMaskedNode<B> {
    return new ActionMaskedNode(
      this.baseNode.setChild(child),
      this.omitActions,
    );
  }

  setFlags(flags: FlagSet): ActionMaskedNode<B> {
    return new ActionMaskedNode(
      this.baseNode.setFlags(flags),
      this.omitActions,
    );
  }

  build(): BuildResult<B> {
    return this.baseNode.build();
  }

  unapplyTransform(): BuildResult<Node<B>> {
    return { ok: true, value: this.baseNode };
  }
}
