import ts from "typescript";
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
