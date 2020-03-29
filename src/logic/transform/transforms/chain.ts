import * as R from "ramda";
import * as ts from "typescript";
import { Transform } from "..";
import { ParentPathElement } from "../../parent-index";
import { fromTsNode } from "../../providers/typescript/convert";
import { unions } from "../../providers/typescript/generated/templates";
import { ActionSet, InputKind, OneOfInputAction } from "../../tree/action";
import { ListNode } from "../../tree/base-nodes";
import {
  BuildResult,
  BuildResultFailure,
  BuildResultSuccess,
  ChildNodeEntry,
  FlagSet,
  Node,
} from "../../tree/node";
import { unreachable } from "../../util";
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
type SimplifiedChainPart =
  | (ChainPartExpression & {
      questionToken?: boolean;
    })
  | (ChainPartCall & {
      questionToken?: boolean;
    })
  | (ChainPartExclamationToken & {
      questionToken?: never;
    });
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
  id?: string;
}
interface ChainPartExclamationToken {
  kind: ChainPartKind.ExclamationToken;
}
function tryFlattenExpression(node: Node<unknown>): ChainPart[] | undefined {
  return (
    tryFlattenPropertyAccessExpression(node) ||
    tryFlattenElementAccessExpression(node) ||
    tryFlattenParenthesizedExpression(node) ||
    tryFlattenNonNullExpression(node)
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
    output.push({
      kind: ChainPartKind.QuestionToken,
      id: valueNode.children[2].node.id + "-question",
    });
  }
  const oldNameNode = valueNode.children[2].node as Node<ts.Identifier>;
  const nameBuildResult = oldNameNode.build();
  if (!nameBuildResult.ok) {
    return undefined;
  }
  const newNameNode = fromTsNode(
    ts.createLiteral(nameBuildResult.value.text),
    unions.Expression,
  );
  newNameNode.id = oldNameNode.id;
  output.push({ kind: ChainPartKind.Expression, expression: newNameNode });
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
    output.push({
      kind: ChainPartKind.QuestionToken,
      id: valueNode.children[2].node.id + "-question",
    });
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
function tryFlattenParenthesizedExpression(
  node: Node<unknown>,
): ChainPart[] | undefined {
  if (
    node.children.length !== 1 ||
    node.children[0].key !== "value" ||
    node.getDebugLabel() !== "ParenthesizedExpression"
  ) {
    return undefined;
  }
  const valueNode = node.children[0].node;
  if (
    !R.equals(
      valueNode.children.map(c => c.key),
      ["expression"],
    )
  ) {
    return undefined;
  }
  return tryFlattenExpression(valueNode.children[0].node);
}
function tryFlattenNonNullExpression(
  node: Node<unknown>,
): ChainPart[] | undefined {
  if (
    node.children.length !== 1 ||
    node.children[0].key !== "value" ||
    node.getDebugLabel() !== "NonNullExpression"
  ) {
    return undefined;
  }
  const valueNode = node.children[0].node;
  if (
    !R.equals(
      valueNode.children.map(c => c.key),
      ["expression"],
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
  output.push({ kind: ChainPartKind.ExclamationToken });
  return output;
}
function unflattenChain(parts: ChainPart[]): BuildResult<Node<ts.Expression>> {
  if (parts.length === 0) {
    return { ok: false, error: { path: [], message: "empty chain" } };
  }
  if (parts[0].kind !== ChainPartKind.Expression) {
    return {
      ok: false,
      error: {
        path: ["0"],
        message: "the first part of a chain must be an expression",
      },
    };
  }
  const simplifiedParts: SimplifiedChainPart[] = [];
  let wasQuestion = false;
  let wasExclamation = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    switch (p.kind) {
      case ChainPartKind.Call:
      case ChainPartKind.Expression: {
        simplifiedParts.push({ ...p, questionToken: wasQuestion });
        wasQuestion = false;
        wasExclamation = false;
        break;
      }
      case ChainPartKind.ExclamationToken: {
        if (wasQuestion) {
          return {
            ok: false,
            error: {
              path: ["" + i],
              message:
                "ExclamationToken can not be immediately after QuestionToken",
            },
          };
        }
        if (!wasExclamation) {
          simplifiedParts.push(p);
          wasExclamation = true;
        }
        break;
      }
      case ChainPartKind.QuestionToken: {
        wasQuestion = true;
        break;
      }
      default: {
        return unreachable(p);
      }
    }
  }
  if (wasQuestion) {
    return {
      ok: false,
      error: {
        path: ["" + (parts.length - 1)],
        message: "QuestionToken must be followed by an expression",
      },
    };
  }
  const unionResult = _unflattenChain(simplifiedParts);
  if (!unionResult.ok) {
    return unionResult;
  }
  return {
    ok: true,
    value: unionResult.value.getDeepestPossibleByPath(["value"]).node,
  };
}
function _unflattenChain(
  parts: SimplifiedChainPart[],
): BuildResult<Node<ts.Expression>> {
  if (parts.length === 1) {
    return { ok: true, value: (parts[0] as ChainPartExpression).expression };
  }
  const leftResult = _unflattenChain(parts.slice(0, -1));
  if (!leftResult.ok) {
    return leftResult;
  }
  const rightPart = parts[parts.length - 1];
  const questionToken = rightPart.questionToken
    ? ts.createToken(ts.SyntaxKind.QuestionDotToken)
    : undefined;
  switch (rightPart.kind) {
    case ChainPartKind.Expression: {
      const rightResult = rightPart.expression.build();
      if (!rightResult.ok || !ts.isStringLiteral(rightResult.value)) {
        let node = fromTsNode(
          ts.createElementAccessChain(
            ts.createIdentifier(""),
            questionToken,
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
        ts.createPropertyAccessChain(
          ts.createIdentifier(""),
          questionToken,
          ts.createIdentifier(""),
        ),
        unions.Expression,
      );
      node = node.setDeepChild(["value", "expression"], leftResult.value);
      const newNameNode = node
        .getByPath(["value", "name"])!
        .actions.setFromString!.apply(rightResult.value.text);
      newNameNode.id = rightPart.expression.id;
      node = node.setDeepChild(["value", "name"], newNameNode);
      return {
        ok: true,
        value: node,
      };
    }
    case ChainPartKind.ExclamationToken: {
      let node = fromTsNode(
        ts.createParen(ts.createNonNullExpression(ts.createLiteral(""))),
        unions.Expression,
      );
      node = node.setDeepChild(
        ["value", "expression", "value", "expression"],
        leftResult.value,
      );
      return { ok: true, value: node };
    }
    case ChainPartKind.Call: {
      return {
        ok: false,
        error: { path: [], message: "ChainPartKind.Call not implemented" },
      };
    }
    default: {
      return unreachable(rightPart);
    }
  }
}
function nodeFromChainPart(p: ChainPart): Node<ChainPart> {
  if (p.kind === ChainPartKind.Expression) {
    return new ChainPartExpressionNode(p);
  }
  const node = new ChainPartConstantNode(p);
  if (p.kind === ChainPartKind.QuestionToken && p.id) {
    node.id = p.id;
  }
  return node;
}
export const chainTransform: Transform = node => {
  const parts = tryFlattenExpression(node);
  if (!parts) {
    return node;
  }
  const chainNode = new ChainNode(
    parts.map(p => new ChainPartUnionNode(nodeFromChainPart(p))),
  );
  if (parts[0].kind === ChainPartKind.Expression) {
    chainNode.id = parts[0].expression.id + "-chain";
  }
  return node.setChild({ key: "value", node: chainNode });
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
    this.id = part.expression.id;
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
    return new ChainPartExpressionNode({ ...this.part, expression });
  }
  clone(): ChainPartExpressionNode {
    return new ChainPartExpressionNode(this.part);
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
    this.id = baseNode.id;
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
          | {
              fromBase: false;
              label: string;
              chainPart: ChainPart;
            }
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
              (e): Variant => ({ fromBase: true, baseVariant: e }),
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
    return new ChainPartUnionNode(baseNode);
  }
  clone(): ChainPartUnionNode {
    return new ChainPartUnionNode(this.baseNode);
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
