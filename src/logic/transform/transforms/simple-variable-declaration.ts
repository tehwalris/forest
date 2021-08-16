import * as R from "ramda";
import { Transform } from "..";
import { ActionSet } from "../../tree/action";
import {
  BuildResult,
  ChildNodeEntry,
  DisplayInfo,
  FlagSet,
  LabelPart,
  LabelStyle,
  Node,
} from "../../tree/node";
import {
  compressChildrenTransform,
  CompressedNode,
} from "./compress-useless-values";
import { ParentPathElement } from "../../parent-index";
import { groupDoc, leafDoc } from "../../tree/display-line";
import { arrayFromTextSize } from "../../text-measurement";
import { NodeKind } from "divetree-core";
import {
  ListTemplate,
  ListTemplateNode,
  TemplateUnionNode,
} from "../../providers/typescript/template-nodes";
import ts from "typescript";

// HACK There should be a better way to get the type of a node
function isVariableStatement(node: Node<unknown>): boolean {
  return R.equals(
    node.children.map((c) => c.key),
    ["declarationList"],
  );
}

function isVariableDeclarationList(node: Node<unknown>): boolean {
  return (
    node instanceof ListTemplateNode &&
    ((node as any).template as ListTemplate<ts.Node, ts.Node>).childUnion
      .name === "VariableDeclaration"
  );
}

function isForInitializerWithVariableDeclarationList(
  node: Node<unknown>,
): boolean {
  return (
    node instanceof TemplateUnionNode &&
    node.getUnionName() === "ForInitializer" &&
    node.children.length === 1 &&
    node.children[0].key === "value" &&
    isVariableDeclarationList(node.children[0].node)
  );
}

export const simpleVariableDeclarationTransform: Transform = <B>(
  node: Node<B>,
): Node<B> => {
  if (isForInitializerWithVariableDeclarationList(node)) {
    return compressForInitializerWithVariableDeclarationList(node);
  }

  if (!isVariableStatement(node)) {
    return node;
  }
  const oldDeclarationListNode = node.getByPath(["declarationList"]);
  if (!oldDeclarationListNode) {
    return node;
  }
  const newDeclarationListNode = compressDeclarationListTransform(
    oldDeclarationListNode,
  );
  if (newDeclarationListNode === oldDeclarationListNode) {
    return node;
  }

  let newNode: Node<B> = node.setChild({
    key: "declarationList",
    node: newDeclarationListNode,
  });
  newNode.id = node.id;
  newNode = compressChildrenTransform(newNode);
  return newNode;
};

const compressForInitializerWithVariableDeclarationList: Transform = (node) => {
  const oldDeclarationListNode = node.getByPath(["value"]);
  if (!oldDeclarationListNode) {
    return node;
  }
  const newDeclarationListNode = compressDeclarationListTransform(
    oldDeclarationListNode,
  );
  if (newDeclarationListNode === oldDeclarationListNode) {
    return node;
  }

  return node.setChild({
    key: "value",
    node: newDeclarationListNode,
  });
};

const compressDeclarationListTransform: Transform = (node) => {
  if (node.children.length !== 1) {
    return node;
  }
  const onlyChildEntry = node.children[0];
  const initializerNode = onlyChildEntry.node.getByPath(["initializer"]);
  if (!initializerNode) {
    return node;
  }

  let maskedNode: Node<unknown> = new ActionMaskedNode(
    node,
    Object.keys(node.actions),
  );
  maskedNode = maskedNode.setDeepChild(
    [onlyChildEntry.key, "initializer"],
    initializerNode,
  );
  maskedNode.id = node.id;

  const compressedNode = new CompressedNode(
    node,
    node.getByPath([onlyChildEntry.key])!,
    compressDeclarationListTransform,
    (p, c) => [p, c],
    (args) => {
      const childDoc = onlyChildEntry.node.buildDoc(args);
      const flavor = (node.flags as any).variableFlavor?.value;
      const { measureLabel, showChildNavigationHints, updatePostLayoutHints } =
        args;
      if (showChildNavigationHints || !childDoc || !flavor) {
        return childDoc;
      }
      const label: LabelPart[] = [
        { text: flavor + " ", style: LabelStyle.SYNTAX_SYMBOL },
      ];
      updatePostLayoutHints(`${node.id}-flavor`, (oldHints) => ({
        ...oldHints,
        styleAsText: true,
        label,
      }));
      return groupDoc([
        leafDoc({
          kind: NodeKind.TightLeaf,
          id: `${node.id}-flavor`,
          size: arrayFromTextSize(measureLabel(label)),
        }),
        childDoc,
      ]);
    },
  );
  compressedNode.id = node.id;
  return compressedNode;
};

class ActionMaskedNode<B> extends Node<B> {
  children: ChildNodeEntry<unknown>[];
  flags: FlagSet;
  actions: ActionSet<Node<B>>;

  constructor(
    private baseNode: Node<B>,
    private omitActions: (keyof ActionSet<Node<B>> & string)[],
  ) {
    super();
    this.id = baseNode.id;
    this.children = baseNode.children;
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
