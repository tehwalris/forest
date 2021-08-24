// src/logic/transform/transforms/expression-statement.ts

var exampleExpressionNode, fromTsNode, unions, node, transform: any;
declare namespace ts {
  type Expression = any;
  var createExpressionStatement: any;
}

export function replace(...args: any[]) {
  let nodeForReplace = args[0];
  const replaceResult = exampleExpressionNode.actions.replace?.apply(...args);
  if (replaceResult && replaceResult !== exampleExpressionNode) {
    const buildResult = replaceResult.build();
    if (!buildResult.ok) {
      console.warn("expected expressionReplaceResult to build successfully");
      return this;
    }
    nodeForReplace = fromTsNode(
      ts.createExpressionStatement(buildResult.value as ts.Expression),
      unions.Expression,
    );
  }

  const nodeAfterReplace = node.actions.replace?.apply(nodeForReplace);
  if (!nodeAfterReplace || nodeAfterReplace === node) {
    return this;
  }
  return transform(nodeAfterReplace);
}
