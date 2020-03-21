import * as R from "ramda";
import { Transform } from "..";
import { ActionSet } from "../../tree/action";
import { Link } from "../../tree/base";
import {
  BuildResult,
  ChildNodeEntry,
  DisplayInfo,
  FlagSet,
  Node,
} from "../../tree/node";
import {
  compressChildrenTransform,
  CompressedNode,
} from "./compress-useless-values";
import { ParentPathElement } from "../../parent-index";

// HACK There should be a better way to get the type of a node
function isVariableStatement(node: Node<unknown>): boolean {
  return R.equals(
    node.children.map(c => c.key),
    ["declarationList"],
  );
}

export const simpleVariableDeclarationTransform: Transform = <B>(
  node: Node<B>,
): Node<B> => {
  if (!isVariableStatement(node)) {
    return node;
  }
  const declarationListNode = node.getByPath(["declarationList"]);
  if (declarationListNode?.children.length !== 1) {
    return node;
  }
  const onlyChildEntry = declarationListNode.children[0];
  const initializerNode = onlyChildEntry.node.getByPath(["initializer"]);
  if (!initializerNode?.actions.toggle || !initializerNode.children.length) {
    return node;
  }

  let newDeclarationListNode: Node<unknown> = new ActionMaskedNode(
    declarationListNode,
    Object.keys(declarationListNode.actions),
  );
  newDeclarationListNode = newDeclarationListNode.setDeepChild(
    [onlyChildEntry.key, "initializer"],
    new ActionMaskedNode(initializerNode, ["toggle"]),
  );
  newDeclarationListNode = compressDeclarationListTransform(
    newDeclarationListNode,
  );
  newDeclarationListNode.id = declarationListNode.id;

  let newNode: Node<B> = node.setChild({
    key: "declarationList",
    node: newDeclarationListNode,
  });
  newNode = compressChildrenTransform(newNode);
  newNode.id = node.id;
  return newNode;
};

const compressDeclarationListTransform: Transform = node => {
  const onlyChildEntry = node.children[0];
  if (!onlyChildEntry) {
    return node;
  }
  return new CompressedNode(
    node,
    node.getByPath([onlyChildEntry.key])!,
    compressDeclarationListTransform,
    (p, c) => [c],
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
    this.actions = {};
    for (const [k, a] of Object.entries(baseNode.actions)) {
      if (omitActions.includes(k)) {
        continue;
      }
      this.actions[k] = a && {
        ...a,
        apply: (...args: any[]) =>
          new ActionMaskedNode(
            (a.apply as any).call(a, ...args) as Node<B>,
            this.omitActions,
          ),
      };
    }
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

  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    return this.baseNode.getDisplayInfo(parentPath);
  }

  getDebugLabel(): string | undefined {
    return this.baseNode.getDebugLabel();
  }

  build(): BuildResult<B> {
    return this.baseNode.build();
  }

  unapplyTransform(): BuildResult<Node<B>> {
    return { ok: true, value: this.baseNode };
  }
}
