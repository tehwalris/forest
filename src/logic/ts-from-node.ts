import ts from "typescript";
import { getBinaryOperatorPrecedence } from "./binary-operator";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { nodeFromTsNode } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import { getStructContent } from "./struct";
import {
  isToken,
  isTsBinaryOperatorToken,
  isTsQuestionDotToken,
} from "./ts-type-predicates";
import { unreachable } from "./util";

function tsNodeArrayFromNode(node: Node): ts.Node[] {
  if (node.kind !== NodeKind.List) {
    throw new Error("node is not a list");
  }
  return node.content.map((c) => tsNodeFromNode(c));
}

function tsIfStatementFromIfBranchNode(node: Node): ts.IfStatement {
  if (node.kind !== NodeKind.List || node.listKind !== ListKind.IfBranch) {
    throw new Error("node is not a ListNode with listKind IfBranch");
  }
  const content = getStructContent(node, ["statement"], ["expression"]);
  return ts.createIf(
    content.expression
      ? (tsNodeFromNode(content.expression) as ts.Expression)
      : ts.createLiteral(true),
    tsNodeFromNode(content.statement) as ts.Statement,
  );
}

export function tsNodeFromNode(node: Node): ts.Node {
  if (node.kind === NodeKind.Token) {
    return node.tsNode;
  }
  switch (node.listKind) {
    case ListKind.TightExpression: {
      if (node.content.length === 0) {
        throw new Error("empty TightExpression");
      }
      const lastChild = node.content[node.content.length - 1];
      if (node.content.length === 1) {
        return tsNodeFromNode(lastChild);
      }

      const secondToLastChild = node.content[node.content.length - 2];
      let questionDotToken: ts.QuestionDotToken | undefined;
      if (isToken(secondToLastChild, isTsQuestionDotToken)) {
        questionDotToken = secondToLastChild.tsNode;
      }

      const restNode = {
        ...node,
        content: node.content.slice(0, questionDotToken ? -2 : -1),
      };

      if (
        lastChild.kind === NodeKind.List &&
        lastChild.listKind === ListKind.CallArguments
      ) {
        return ts.factory.createCallChain(
          tsNodeFromNode(restNode) as ts.Expression,
          questionDotToken,
          [],
          lastChild.content.map((c) => tsNodeFromNode(c) as ts.Expression),
        );
      } else if (lastChild.kind === NodeKind.List) {
        throw new Error("child list has unsupported ListKind");
      } else {
        return ts.factory.createPropertyAccessChain(
          tsNodeFromNode(restNode) as ts.Expression,
          questionDotToken,
          tsNodeFromNode(lastChild) as ts.Identifier,
        );
      }
    }
    case ListKind.LooseExpression: {
      if (node.content.length === 0) {
        throw new Error("empty LooseExpression");
      }
      if (node.content.length === 1) {
        return tsNodeFromNode(node.content[0]);
      }
      const operators = node.content
        .map((c, i) => {
          if (c.kind === NodeKind.Token && isTsBinaryOperatorToken(c.tsNode)) {
            return {
              i,
              tsNode: c.tsNode,
              precedence: getBinaryOperatorPrecedence(c.tsNode.kind),
            };
          }
          return undefined;
        })
        .filter((v) => v)
        .map((v) => v!);
      const minPrecedence = Math.min(...operators.map((o) => o.precedence));
      const rightAssociative =
        minPrecedence ===
        getBinaryOperatorPrecedence(ts.SyntaxKind.AsteriskAsteriskToken);
      const splitAt = (
        rightAssociative ? operators : [...operators].reverse()
      ).find((o) => o.precedence === minPrecedence);
      if (!splitAt) {
        throw new Error("LooseExpression contains no operators");
      }
      return ts.createBinary(
        tsNodeFromNode({
          ...node,
          content: node.content.slice(0, splitAt.i),
        }) as ts.Expression,
        splitAt.tsNode,
        tsNodeFromNode({
          ...node,
          content: node.content.slice(splitAt.i + 1),
        }) as ts.Expression,
      );
    }
    case ListKind.ParenthesizedExpression:
      if (node.content.length !== 1) {
        throw new Error("ParenthesizedExpression must have exactly 1 child");
      }
      return ts.createParen(tsNodeFromNode(node.content[0]) as ts.Expression);
    case ListKind.CallArguments:
      throw new Error(
        "CallArguments should be handled by TightExpression parent",
      );
    case ListKind.IfBranches: {
      if (node.content.length < 1) {
        throw new Error("IfBranches must have at least 1 child");
      }
      let first: ts.IfStatement = tsIfStatementFromIfBranchNode(
        node.content[0],
      );
      let last: ts.IfStatement = first;
      for (let i = 1; i < node.content.length; i++) {
        // TODO allow else
        const next = tsIfStatementFromIfBranchNode(node.content[i]);
        last = ts.updateIf(last, last.expression, last.thenStatement, next);
        if (i === 1) {
          first = last;
        }
        last = next;
      }
      return first;
    }
    case ListKind.IfBranch:
      throw new Error("IfBranch should be handled by IfBranches parent");
    case ListKind.UnknownTsNodeArray:
      throw new Error(
        "UnknownTsNodeArray should be handled by TightExpression parent",
      );
    case ListKind.TsNodeStruct:
      if (node.tsSyntaxKind !== ts.SyntaxKind.ArrowFunction) {
        throw new Error("TsNodeStruct only supports ArrowFunction");
      }
      const content = getStructContent(
        node,
        ["parameters", "equalsGreaterThanToken", "body"],
        ["typeParameters", "modifiers"],
      );
      return ts.createArrowFunction(
        content.modifiers &&
          (tsNodeArrayFromNode(content.modifiers) as ts.Modifier[]),
        content.typeParameters &&
          (tsNodeArrayFromNode(
            content.typeParameters,
          ) as ts.TypeParameterDeclaration[]),
        tsNodeArrayFromNode(content.parameters) as ts.ParameterDeclaration[],
        undefined,
        tsNodeFromNode(
          content.equalsGreaterThanToken,
        ) as ts.EqualsGreaterThanToken,
        tsNodeFromNode(content.body) as ts.ConciseBody,
      );
    case ListKind.File:
      return ts.updateSourceFileNode(
        astFromTypescriptFileContent(""),
        node.content.map((c) => tsNodeFromNode(c) as ts.Statement),
      );
    default:
      return unreachable(node.listKind);
  }
}
