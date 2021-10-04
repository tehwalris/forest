import ts from "typescript";
import { getBinaryOperatorPrecedence } from "./binary-operator";
import { ListKind, Node, NodeKind } from "./interfaces";
import { astFromTypescriptFileContent } from "./parse";
import { getStructContent } from "./struct";
import { onlyChildFromNode } from "./tree-utils/access";
import {
  flagsForTsVarLetConst,
  isToken,
  isTsBinaryOperatorToken,
  isTsQuestionDotToken,
  isTsVarLetConst,
} from "./ts-type-predicates";
import { unreachable } from "./util";

function tsNodeArrayFromNode(node: Node): ts.Node[] {
  if (node.kind !== NodeKind.List) {
    throw new Error("node is not a list");
  }
  return node.content.map((c) => tsNodeFromNode(c));
}

function tsIfStatementFromIfBranchNode(
  node: Node,
  elseStatement: ts.Statement | undefined,
): ts.Statement {
  if (node.kind !== NodeKind.List || node.listKind !== ListKind.IfBranch) {
    throw new Error("node is not a ListNode with listKind IfBranch");
  }
  const content = getStructContent(
    node,
    ["statement"],
    ["expression", "ifToken"],
  );
  if (!content.expression) {
    if (elseStatement) {
      throw new Error(
        "if branch has no condition, but can't be made an else, since it is not the last branch",
      );
    }
    return tsNodeFromNode(content.statement) as ts.Statement;
  }
  return ts.createIf(
    tsNodeFromNode(onlyChildFromNode(content.expression)) as ts.Expression,
    tsNodeFromNode(content.statement) as ts.Statement,
    elseStatement,
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
      let current: ts.Statement | undefined;
      for (let i = node.content.length - 1; i >= 0; i--) {
        current = tsIfStatementFromIfBranchNode(node.content[i], current);
      }
      return current!;
    }
    case ListKind.IfBranch:
      throw new Error("IfBranch should be handled by IfBranches parent");
    case ListKind.ObjectLiteralElement: {
      let syntaxKind:
        | ts.SyntaxKind.PropertyAssignment
        | ts.SyntaxKind.ShorthandPropertyAssignment
        | ts.SyntaxKind.SpreadAssignment;
      if (node.content.length < 1) {
        throw new Error("ObjectLiteralElement must have at least 1 child");
      }
      if (isToken(node.content[0], ts.isDotDotDotToken)) {
        syntaxKind = ts.SyntaxKind.SpreadAssignment;
      } else if (node.content.length === 1) {
        syntaxKind = ts.SyntaxKind.ShorthandPropertyAssignment;
      } else {
        syntaxKind = ts.SyntaxKind.PropertyAssignment;
      }

      switch (syntaxKind) {
        case ts.SyntaxKind.PropertyAssignment: {
          if (node.content.length !== 3) {
            throw new Error(
              `want length 3 for PropertyAssignment, but got ${node.content.length}`,
            );
          }
          if (
            !isToken(
              node.content[1],
              (tsNode): tsNode is ts.Token<ts.SyntaxKind.ColonToken> =>
                tsNode.kind === ts.SyntaxKind.ColonToken,
            )
          ) {
            throw new Error("expected node.content[1] to be ColonToken");
          }
          return ts.createPropertyAssignment(
            tsNodeFromNode(node.content[0]) as ts.PropertyName,
            tsNodeFromNode(node.content[2]) as ts.Expression,
          );
        }
        case ts.SyntaxKind.ShorthandPropertyAssignment: {
          return ts.createShorthandPropertyAssignment(
            tsNodeFromNode(node.content[0]) as ts.Identifier,
          );
        }
        case ts.SyntaxKind.SpreadAssignment: {
          if (node.content.length !== 2) {
            throw new Error(
              `want length 2 for SpreadAssignment, but got ${node.content.length}`,
            );
          }
          return ts.createSpreadAssignment(
            tsNodeFromNode(node.content[1]) as ts.Expression,
          );
        }
        default:
          return unreachable(syntaxKind);
      }
    }
    case ListKind.UnknownTsNodeArray:
      throw new Error("UnknownTsNodeArray should be handled by parent");
    case ListKind.TsNodeStruct:
      switch (node.tsSyntaxKind) {
        case undefined:
          throw new Error("TsNodeStruct with undefined tsSyntaxKind");
        case ts.SyntaxKind.ArrowFunction: {
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
            tsNodeArrayFromNode(
              content.parameters,
            ) as ts.ParameterDeclaration[],
            undefined,
            tsNodeFromNode(
              content.equalsGreaterThanToken,
            ) as ts.EqualsGreaterThanToken,
            tsNodeFromNode(content.body) as ts.ConciseBody,
          );
        }
        case ts.SyntaxKind.VariableStatement: {
          const content = getStructContent(node, ["declarationList"], []);
          return ts.createVariableStatement(
            undefined,
            tsNodeFromNode(
              content.declarationList,
            ) as ts.VariableDeclarationList,
          );
        }
        case ts.SyntaxKind.VariableDeclaration: {
          const content = getStructContent(
            node,
            ["name"],
            ["type", "initializer"],
          );
          return ts.createVariableDeclaration(
            tsNodeFromNode(content.name) as ts.BindingName,
            content.type && (tsNodeFromNode(content.type) as ts.TypeNode),
            content.initializer &&
              (tsNodeFromNode(content.initializer) as ts.Expression),
          );
        }
        default:
          throw new Error(
            `TsNodeStruct with unsupported tsSyntaxKind: ${
              ts.SyntaxKind[node.tsSyntaxKind]
            }`,
          );
      }
    case ListKind.TsNodeList:
      switch (node.tsSyntaxKind) {
        case undefined:
          throw new Error("TsNodeList with undefined tsSyntaxKind");
        case ts.SyntaxKind.Block:
          return ts.createBlock(tsNodeArrayFromNode(node) as ts.Statement[]);
        case ts.SyntaxKind.ObjectLiteralExpression:
          return ts.createObjectLiteral(
            tsNodeArrayFromNode(node) as ts.ObjectLiteralElementLike[],
          );
        case ts.SyntaxKind.ArrayLiteralExpression:
          return ts.createArrayLiteral(
            tsNodeArrayFromNode(node) as ts.Expression[],
          );
        case ts.SyntaxKind.VariableDeclarationList: {
          if (node.content.length < 2) {
            throw new Error(
              "VariableDeclarationList must have at least 2 children (var/let/const and at least 1 VariableDeclaration)",
            );
          }

          const varLetConst = tsNodeFromNode(node.content[0]);
          if (!isTsVarLetConst(varLetConst)) {
            throw new Error("first child is not var/let/const");
          }

          return ts.createVariableDeclarationList(
            tsNodeArrayFromNode({
              ...node,
              content: node.content.slice(1),
            }) as ts.VariableDeclaration[],
            flagsForTsVarLetConst(varLetConst),
          );
        }
        default:
          throw new Error(
            `TsNodeList with unsupported tsSyntaxKind: ${
              ts.SyntaxKind[node.tsSyntaxKind]
            }`,
          );
      }
    case ListKind.File:
      return ts.updateSourceFileNode(
        astFromTypescriptFileContent(""),
        node.content.map((c) => tsNodeFromNode(c) as ts.Statement),
      );
    default:
      return unreachable(node.listKind);
  }
}
