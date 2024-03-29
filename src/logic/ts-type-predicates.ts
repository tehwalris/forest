import ts from "typescript";
import { Node, NodeKind, TokenNode } from "./interfaces";
import { matchesUnion } from "./legacy-templates/match";
import { unions } from "./legacy-templates/templates";
import { unreachable } from "./util";
export function isToken<T extends ts.Node>(
  node: Node,
  tsNodePredicate: (tsNode: ts.Node) => tsNode is T,
): node is TokenNode & {
  tsNode: T;
} {
  return node.kind === NodeKind.Token && tsNodePredicate(node.tsNode);
}
export function isTsQuestionDotToken(
  node: ts.Node,
): node is ts.QuestionDotToken {
  return ts.isToken(node) && node.kind === ts.SyntaxKind.QuestionDotToken;
}
export function isTsColonToken(node: ts.Node): node is ts.ColonToken {
  return ts.isToken(node) && node.kind === ts.SyntaxKind.ColonToken;
}
export function isTsExclamationToken(
  node: ts.Node,
): node is ts.ExclamationToken {
  return ts.isToken(node) && node.kind === ts.SyntaxKind.ExclamationToken;
}
function isTsPrefixUnaryOperatorToken(
  node: ts.Node,
): node is ts.Token<ts.PrefixUnaryOperator> {
  return matchesUnion<ts.Token<ts.PrefixUnaryOperator>>(
    node,
    unions.PrefixUnaryOperator,
  );
}
export function isTsPrefixUnaryOperatorTokenWithExpectedParent(
  node: ts.Node,
): node is ts.Token<ts.PrefixUnaryOperator> & {
  parent: ts.PrefixUnaryExpression;
} {
  return (
    isTsPrefixUnaryOperatorToken(node) &&
    node.parent?.kind === ts.SyntaxKind.PrefixUnaryExpression
  );
}
function isTsPostfixUnaryOperatorToken(
  node: ts.Node,
): node is ts.Token<ts.PostfixUnaryOperator> {
  return matchesUnion<ts.Token<ts.PostfixUnaryOperator>>(
    node,
    unions.PostfixUnaryOperator,
  );
}
export function isTsPostfixUnaryOperatorTokenWithExpectedParent(
  node: ts.Node,
): node is ts.Token<ts.PostfixUnaryOperator> & {
  parent: ts.PostfixUnaryExpression;
} {
  return (
    isTsPostfixUnaryOperatorToken(node) &&
    node.parent?.kind === ts.SyntaxKind.PostfixUnaryExpression
  );
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
type VarLetConstToken = ts.Token<
  | ts.SyntaxKind.VarKeyword
  | ts.SyntaxKind.LetKeyword
  | ts.SyntaxKind.ConstKeyword
>;
export function isTsVarLetConst(node: ts.Node): node is VarLetConstToken {
  return (
    ts.isToken(node) &&
    [
      ts.SyntaxKind.VarKeyword,
      ts.SyntaxKind.LetKeyword,
      ts.SyntaxKind.ConstKeyword,
    ].includes(node.kind)
  );
}
export function flagsForTsVarLetConst(node: VarLetConstToken): ts.NodeFlags {
  if (node.kind === ts.SyntaxKind.VarKeyword) {
    return ts.NodeFlags.None;
  } else if (node.kind === ts.SyntaxKind.LetKeyword) {
    return ts.NodeFlags.Let;
  } else if (node.kind === ts.SyntaxKind.ConstKeyword) {
    return ts.NodeFlags.Const;
  } else {
    return unreachable(node.kind);
  }
}
