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
import { ActionSet } from "../../tree/action";
import { ListNode } from "../../tree/base-nodes";
import { ParentPathElement } from "../../parent-index";
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
  arguments: Node<ts.Expression[]>;
}
interface ChainPartQuestionToken {
  kind: ChainPartKind.QuestionToken;
}
interface ChainPartExclamationToken {
  kind: ChainPartKind.ExclamationToken;
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
  const output: ChainPart[] = [
    { kind: ChainPartKind.Expression, expression: valueNode.children[0].node },
  ];
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
  return [];
}
function unflattenChain(parts: ChainPart[]): Node<ts.Expression> {
  // TODO
  const node = fromTsNode(
    ts.createIf(ts.createLiteral(""), ts.createBlock([])),
    unions.Expression,
  );
  return node;
}
export const chainTransform: Transform = node => {
  return node;
};
class ChainNode extends ListNode<ChainPart, unknown> {
  flags: FlagSet = {};
  clone(): ChainNode {
    const node = new ChainNode([]);
    node.children = this.children;
    node.id = this.id;
    return node;
  }
  setChild(child: ChildNodeEntry<ChainPart>): ChainNode {
    const node = this.clone();
    node.children = node.children.map(c => (c.key === child.key ? child : c));
    return node;
  }
  setFlags(flags: FlagSet): ChainNode {
    throw new Error("not implemented");
  }
  build(): BuildResult<unknown> {
    const result = this.unapplyTransform();
    if (!result.ok) {
      return result;
    }
    return result.value.build();
  }
  unapplyTransform(): BuildResult<Node<unknown>> {
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
    const ifNode = unflattenChain(
      childBuildResults.map(
        r => (r.result as BuildResultSuccess<ChainPart>).value,
      ),
    );
    return { ok: true, value: ifNode };
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
    return new ConstantChainPartNode(part);
  }
  getDebugLabel(): string | undefined {
    return "ChainNode";
  }
}
class ConstantChainPartNode extends Node<ChainPart> {
  children: ChildNodeEntry<unknown>[] = [];
  flags: FlagSet = {};
  actions: ActionSet<Node<ChainPart>> = {};
  constructor(private part: ChainPart) {
    super();
  }
  clone(): ConstantChainPartNode {
    const node = new ConstantChainPartNode(this.part);
    node.id = this.id;
    return node;
  }
  setChild(child: ChildNodeEntry<unknown>): ConstantChainPartNode {
    throw new Error("ConstantChainPartNode can't have children");
  }
  setFlags(flags: FlagSet): ConstantChainPartNode {
    throw new Error("not implemented");
  }
  build(): BuildResult<ChainPart> {
    return { ok: true, value: this.part };
  }
  getDebugLabel() {
    return this.part.kind;
  }
}
