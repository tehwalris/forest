import ts from "typescript";
import { Node, NodeKind, TokenNode } from "./interfaces";

export function isToken<T extends ts.Node>(
  node: Node,
  tsNodePredicate: (tsNode: ts.Node) => tsNode is T,
): node is TokenNode & { tsNode: T } {
  return node.kind === NodeKind.Token && tsNodePredicate(node.tsNode);
}

export function isTsQuestionDotToken(
  node: ts.Node,
): node is ts.QuestionDotToken {
  return ts.isToken(node) && node.kind === ts.SyntaxKind.QuestionDotToken;
}

export function isTsBinaryOperatorToken(
  node: ts.Node,
): node is ts.BinaryOperatorToken {
  return (
    ts.isToken(node) &&
    node.kind >= ts.SyntaxKind.FirstBinaryOperator &&
    node.kind <= ts.SyntaxKind.LastBinaryOperator
  );
}
