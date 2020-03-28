import { Transform } from "..";
import {
  Node,
  ChildNodeEntry,
  FlagSet,
  BuildResult,
  BuildResultFailure,
  BuildResultSuccess,
  DisplayInfo,
  LabelStyle,
  DisplayInfoPriority,
} from "../../tree/node";
import * as R from "ramda";
import * as ts from "typescript";
import { fromTsNode } from "../../providers/typescript/convert";
import { unions } from "../../providers/typescript/generated/templates";
import { ActionSet, InputKind, OneOfInputAction } from "../../tree/action";
import { ListNode } from "../../tree/base-nodes";
import { ParentPathElement } from "../../parent-index";
import { StructTemplateNode } from "../../providers/typescript/template-nodes";
enum ChainPartKind {
  Expression = "Expression",
  Call = "Call",
  QuestionToken = "QuestionToken",
  ExclamationToken = "ExclamationToken",
}
type ChainPart =
  | ChainPartExpression
  | ChainPartCall
  | ChainPartQuestionToken
  | ChainPartExclamationToken;
interface ChainPartExpression {
  kind: ChainPartKind.Expression;
  expression: Node<ts.Expression>;
}
interface ChainPartCall {
  kind: ChainPartKind.Call;
  arguments: Node<ts.Expression>[];
}
interface ChainPartQuestionToken {
  kind: ChainPartKind.QuestionToken;
}
interface ChainPartExclamationToken {
  kind: ChainPartKind.ExclamationToken;
}
function tryFlattenExpression(node: Node<unknown>): ChainPart[] | undefined {
  return (
    tryFlattenPropertyAccessExpression(node) ||
    tryFlattenElementAccessExpression(node)
  );
}
function tryFlattenPropertyAccessExpression(
  node: Node<unknown>,
): ChainPart[] | undefined {
  if (
    node.children.length !== 1 ||
    node.children[0].key !== "value" ||
    node.getDebugLabel() !== "PropertyAccessExpression"
  ) {
    return undefined;
  }
  const valueNode = node.children[0].node;
  if (
    !R.equals(
      valueNode.children.map(c => c.key),
      ["expression", "questionDotToken", "name"],
    )
  ) {
    return undefined;
  }
  const output: ChainPart[] = [];
  const flatExpression = tryFlattenExpression(valueNode.children[0].node);
  if (flatExpression) {
    output.push(...flatExpression);
  } else {
    output.push({
      kind: ChainPartKind.Expression,
      expression: valueNode.children[0].node,
    });
  }
  const questionTokenBuildResult = valueNode.children[1].node?.build();
  if (!questionTokenBuildResult.ok) {
    return undefined;
  }
  if (questionTokenBuildResult.value !== undefined) {
    output.push({ kind: ChainPartKind.QuestionToken });
  }
  const nameBuildResult = (valueNode.children[2].node as Node<
    ts.Identifier
  >).build();
  if (!nameBuildResult.ok) {
    return undefined;
  }
  output.push({
    kind: ChainPartKind.Expression,
    expression: fromTsNode(
      ts.createLiteral(nameBuildResult.value.text),
      unions.Expression,
    ),
  });
  return output;
}
function tryFlattenElementAccessExpression(
  node: Node<unknown>,
): ChainPart[] | undefined {
  if (
    node.children.length !== 1 ||
    node.children[0].key !== "value" ||
    node.getDebugLabel() !== "ElementAccessExpression"
  ) {
    return undefined;
  }
  const valueNode = node.children[0].node;
  if (
    !R.equals(
      valueNode.children.map(c => c.key),
      ["expression", "questionDotToken", "argumentExpression"],
    )
  ) {
    return undefined;
  }
  const output: ChainPart[] = [];
  const flatExpression = tryFlattenExpression(valueNode.children[0].node);
  if (flatExpression) {
    output.push(...flatExpression);
  } else {
    output.push({
      kind: ChainPartKind.Expression,
      expression: valueNode.children[0].node,
    });
  }
  const questionTokenBuildResult = valueNode.children[1].node?.build();
  if (!questionTokenBuildResult.ok) {
    return undefined;
  }
  if (questionTokenBuildResult.value !== undefined) {
    output.push({ kind: ChainPartKind.QuestionToken });
  }
  const argumentBuildResult = (valueNode.children[2].node as Node<
    ts.Expression | undefined
  >).build();
  if (argumentBuildResult.ok && argumentBuildResult.value === undefined) {
    return undefined;
  }
  output.push({
    kind: ChainPartKind.Expression,
    expression: valueNode.children[2].node,
  });
  return output;
}
function unflattenChain(parts: ChainPart[]): BuildResult<Node<ts.Expression>> {
  if (parts.length === 0) {
    return { ok: false, error: { path: [], message: "empty chain" } };
  }
  if (parts.length === 1) {
    const leftPart = parts[0];
    if (leftPart.kind !== ChainPartKind.Expression) {
      return {
        ok: false,
        error: {
          path: ["0"],
          message: "the first part of a chain must be an expression",
        },
      };
    }
    return { ok: true, value: leftPart.expression };
  }
  const leftResult = unflattenChain(parts.slice(0, -1));
  if (!leftResult.ok) {
    return leftResult;
  }
  const rightPart = parts[parts.length - 1];
  switch (rightPart.kind) {
    case ChainPartKind.Expression: {
      const rightResult = rightPart.expression.build();
      if (!rightResult.ok || !ts.isStringLiteral(rightResult.value)) {
        let node = fromTsNode(
          ts.createElementAccess(
            ts.createIdentifier(""),
            ts.createIdentifier(""),
          ),
          unions.Expression,
        );
        node = node.setDeepChild(["value", "expression"], leftResult.value);
        node = node.setDeepChild(
          ["value", "argumentExpression"],
          rightPart.expression,
        );
        return {
          ok: true,
          value: node,
        };
      }
      let node = fromTsNode(
        ts.createPropertyAccess(
          ts.createIdentifier(""),
          ts.createIdentifier(""),
        ),
        unions.Expression,
      );
      node = node.setDeepChild(["value", "expression"], leftResult.value);
      node = node.setDeepChild(
        ["value", "name"],
        node
          .getByPath(["value", "name"])!
          .actions.setFromString!.apply(rightResult.value.text),
      );
      return {
        ok: true,
        value: node,
      };
    }
    default: {
      return {
        ok: false,
        error: {
          path: ["" + (parts.length - 1)],
          message: `unsupported ChainPartKind ${rightPart.kind}`,
        },
      };
    }
  }
}
function nodeFromChainPart(p: ChainPart): Node<ChainPart> {
  if (p.kind === ChainPartKind.Expression) {
    return new ChainPartExpressionNode(p);
  }
  return new ChainPartConstantNode(p);
}
export const chainTransform: Transform = node => {
  const parts = tryFlattenExpression(node);
  if (!parts) {
    return node;
  }
  const chainNode = new ChainNode(
    parts.map(p => new ChainPartUnionNode(nodeFromChainPart(p))),
  );
  return chainNode as Node<any>;
};
class ChainNode extends ListNode<ChainPart, ts.Expression> {
  flags: FlagSet = {};
  clone(): ChainNode {
    const node = new ChainNode([]);
    node.children = this.children;
    node.id = this.id;
    return node;
  }
  setFlags(flags: FlagSet): ChainNode {
    throw new Error("not implemented");
  }
  build(): BuildResult<ts.Expression> {
    const result = this.unapplyTransform();
    if (!result.ok) {
      return result;
    }
    return result.value.build();
  }
  unapplyTransform(): BuildResult<Node<ts.Expression>> {
    const childBuildResults = this.children.map(c => ({
      key: c.key,
      result: c.node.build(),
    }));
    const firstChildError = childBuildResults.find(r => !r.result.ok);
    if (firstChildError) {
      const error = (firstChildError.result as BuildResultFailure).error;
      return {
        ok: false,
        error: {
          message: error.message,
          path: [...error.path, firstChildError.key],
        },
      };
    }
    return unflattenChain(
      childBuildResults.map(
        r => (r.result as BuildResultSuccess<ChainPart>).value,
      ),
    );
  }
  protected setValue(value: Node<ChainPart>[]): ChainNode {
    const node = new ChainNode(value);
    node.id = this.id;
    return node;
  }
  protected createChild(): Node<ChainPart> {
    const part: ChainPart = {
      kind: ChainPartKind.Expression,
      expression: fromTsNode(ts.createLiteral(""), unions.Expression),
    };
    return new ChainPartConstantNode(part);
  }
  getDebugLabel(): string | undefined {
    return "ChainNode";
  }
}
class ChainPartExpressionNode extends Node<ChainPartExpression> {
  children: ChildNodeEntry<unknown>[];
  flags: FlagSet;
  actions: ActionSet<ChainPartExpressionNode>;
  constructor(private part: ChainPartExpression) {
    super();
    this.children = part.expression.children;
    this.flags = part.expression.flags;
    this.actions = {};
    for (const [k, a] of Object.entries(part.expression.actions)) {
      this.actions[k] = a && {
        ...a,
        apply: (...args: any[]) =>
          this.updateExpression((a.apply as any).call(a, ...args)),
      };
    }
  }
  private updateExpression(expression: Node<ts.Expression>) {
    const node = new ChainPartExpressionNode({
      ...this.part,
      expression,
    });
    node.id = this.id;
    return node;
  }
  clone(): ChainPartExpressionNode {
    const node = new ChainPartExpressionNode(this.part);
    node.id = this.id;
    return node;
  }
  setChild(child: ChildNodeEntry<unknown>): ChainPartExpressionNode {
    return this.updateExpression(this.part.expression.setChild(child));
  }
  setFlags(flags: FlagSet): ChainPartExpressionNode {
    return this.updateExpression(this.part.expression.setFlags(flags));
  }
  build(): BuildResult<ChainPartExpression> {
    return { ok: true, value: this.part };
  }
  getDebugLabel() {
    return this.part.expression.getDebugLabel();
  }
  getDisplayInfo(parentPath: ParentPathElement[]) {
    return this.part.expression.getDisplayInfo(parentPath);
  }
}
class ChainPartConstantNode extends Node<ChainPart> {
  children: ChildNodeEntry<unknown>[] = [];
  flags: FlagSet = {};
  actions: ActionSet<Node<ChainPart>> = {};
  constructor(private part: ChainPart) {
    super();
  }
  clone(): ChainPartConstantNode {
    const node = new ChainPartConstantNode(this.part);
    node.id = this.id;
    return node;
  }
  setChild(child: ChildNodeEntry<unknown>): ChainPartConstantNode {
    throw new Error("ChainPartConstantNode can't have children");
  }
  setFlags(flags: FlagSet): ChainPartConstantNode {
    throw new Error("not implemented");
  }
  build(): BuildResult<ChainPart> {
    return { ok: true, value: this.part };
  }
  getDebugLabel() {
    return this.part.kind;
  }
}
class ChainPartUnionNode extends Node<ChainPart> {
  children: ChildNodeEntry<unknown>[];
  flags: FlagSet;
  actions: ActionSet<ChainPartUnionNode>;
  constructor(private baseNode: Node<ChainPart>) {
    super();
    this.children = baseNode.children;
    this.flags = baseNode.flags;
    this.actions = {};
    const baseActions: ActionSet<Node<ChainPart>> = {
      setVariant: nodeFromChainPart({
        kind: ChainPartKind.Expression,
        expression: fromTsNode(ts.createLiteral(""), unions.Expression),
      }).actions.setVariant,
      ...baseNode.actions,
    };
    for (const [k, a] of Object.entries(baseActions)) {
      if (k === "setVariant" && a?.inputKind === InputKind.OneOf) {
        type Variant =
          | { fromBase: false; label: string; chainPart: ChainPart }
          | {
              fromBase: true;
              baseVariant: unknown;
            };
        const newAction: OneOfInputAction<ChainPartUnionNode, Variant> = {
          ...a,
          oneOf: [
            {
              fromBase: false,
              label: "ChainPartCall",
              chainPart: { kind: ChainPartKind.Call, arguments: [] },
            },
            {
              fromBase: false,
              label: "ChainPartExclamationToken",
              chainPart: { kind: ChainPartKind.ExclamationToken },
            },
            {
              fromBase: false,
              label: "ChainPartQuestionToken",
              chainPart: { kind: ChainPartKind.QuestionToken },
            },
            ...a.oneOf.map(
              (e): Variant => ({
                fromBase: true,
                baseVariant: e,
              }),
            ),
          ],
          apply: variant =>
            this.updateBaseNode(
              variant.fromBase
                ? a.apply(variant.baseVariant)
                : nodeFromChainPart(variant.chainPart),
            ),
          getLabel: variant =>
            variant.fromBase ? a.getLabel(variant.baseVariant) : variant.label,
          getShortcut: variant =>
            variant.fromBase ? a.getShortcut(variant.baseVariant) : undefined,
        };
        this.actions.setVariant = newAction;
      } else {
        this.actions[k] = a && {
          ...a,
          apply: (...args: any[]) =>
            this.updateBaseNode((a.apply as any).call(a, ...args)),
        };
      }
    }
  }
  private updateBaseNode(baseNode: Node<ChainPart>) {
    const node = new ChainPartUnionNode(baseNode);
    node.id = this.id;
    return node;
  }
  clone(): ChainPartUnionNode {
    const node = new ChainPartUnionNode(this.baseNode);
    node.id = this.id;
    return node;
  }
  setChild(child: ChildNodeEntry<unknown>): ChainPartUnionNode {
    return this.updateBaseNode(this.baseNode.setChild(child));
  }
  setFlags(flags: FlagSet): ChainPartUnionNode {
    return this.updateBaseNode(this.baseNode.setFlags(flags));
  }
  unapplyTransform(): BuildResult<Node<ChainPart>> {
    return { ok: true, value: this.baseNode };
  }
  build(): BuildResult<ChainPart> {
    return this.baseNode.build();
  }
  getDebugLabel() {
    return this.baseNode.getDebugLabel();
  }
  getDisplayInfo(parentPath: ParentPathElement[]) {
    return this.baseNode.getDisplayInfo(parentPath);
  }
}
