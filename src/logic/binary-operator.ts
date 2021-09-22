import ts from "typescript";

export function isTsBinaryOperatorToken(
  node: ts.Node,
): node is ts.BinaryOperatorToken {
  return (
    ts.isToken(node) &&
    node.kind >= ts.SyntaxKind.FirstBinaryOperator &&
    node.kind <= ts.SyntaxKind.LastBinaryOperator
  );
}

// https://github.com/microsoft/TypeScript/blob/663b19fe4a7c4d4ddaa61aedadd28da06acd27b6/src/compiler/utilities.ts#L3659
// https://github.com/prettier/prettier/blob/30f82c0356ad3c24e56e79c95933988c02555427/src/language-js/utils.js#L1106
const precedenceByBinaryOperator = new Map<ts.SyntaxKind, number>();
for (const [i, ops] of [
  [
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.PlusEqualsToken,
    ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.CaretEqualsToken,
    ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
  ],
  [ts.SyntaxKind.QuestionQuestionToken],
  [ts.SyntaxKind.BarBarToken],
  [ts.SyntaxKind.AmpersandAmpersandToken],
  [ts.SyntaxKind.BarToken],
  [ts.SyntaxKind.CaretToken],
  [ts.SyntaxKind.AmpersandToken],
  [
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ],
  [
    ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.GreaterThanToken,
    ts.SyntaxKind.LessThanEqualsToken,
    ts.SyntaxKind.GreaterThanEqualsToken,
    ts.SyntaxKind.InstanceOfKeyword,
    ts.SyntaxKind.InKeyword,
    ts.SyntaxKind.AsKeyword,
  ],
  [
    ts.SyntaxKind.LessThanLessThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
  ],
  [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken],
  [
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
  ],
  [ts.SyntaxKind.AsteriskAsteriskToken],
].entries()) {
  for (const op of ops) {
    precedenceByBinaryOperator.set(op, i);
  }
}

export function getBinaryOperatorPrecedence(operator: ts.BinaryOperator) {
  const precedence = precedenceByBinaryOperator.get(operator);
  if (precedence === undefined) {
    throw new Error(
      `unknown operator ${operator} (${ts.SyntaxKind[operator]})`,
    );
  }
  return precedence;
}
