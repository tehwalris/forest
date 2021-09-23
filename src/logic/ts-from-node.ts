import ts from "typescript";
import {
  getBinaryOperatorPrecedence,
  isTsBinaryOperatorToken,
} from "./binary-operator";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { astFromTypescriptFileContent } from "./parse";
import { unreachable } from "./util";

function tsNodeArrayFromNode(node: Node): ts.Node[] {
  if (node.kind !== NodeKind.List) {
    throw new Error("node is not a list");
  }
  return node.content.map((c) => tsNodeFromNode(c));
}

function getStructContent<RK extends string, OK extends string>(
  node: ListNode,
  requiredKeys: RK[],
  optionalKeys: OK[],
): { [K in RK]: Node } & { [K in OK]: Node | undefined } {
  if (
    !node.structKeys ||
    node.structKeys.length !== node.content.length ||
    new Set(node.structKeys).size !== node.structKeys.length
  ) {
    throw new Error("structKeys is invalid");
  }

  const expectedKeySet = new Set<string>([...requiredKeys, ...optionalKeys]);
  if (expectedKeySet.size !== requiredKeys.length + optionalKeys.length) {
    throw new Error("requiredKeys and optionalKeys contain duplicates");
  }
  if (!node.structKeys.every((k) => expectedKeySet.has(k))) {
    throw new Error("some structKeys are not known");
  }

  const output: { [key: string]: Node | undefined } = {};
  for (const k of requiredKeys) {
    const i = node.structKeys.indexOf(k);
    if (i === -1) {
      throw new Error(`required key not found: ${k}`);
    }
    output[k] = node.content[i];
  }
  for (const k of optionalKeys) {
    const i = node.structKeys.indexOf(k);
    if (i !== -1) {
      output[k] = node.content[i];
    }
  }
  return output as any;
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
      const restNode = { ...node, content: node.content.slice(0, -1) };
      if (
        lastChild.kind === NodeKind.List &&
        lastChild.listKind === ListKind.CallArguments
      ) {
        return ts.createCall(
          tsNodeFromNode(restNode) as ts.Expression,
          undefined,
          lastChild.content.map((c) => tsNodeFromNode(c) as ts.Expression),
        );
      } else if (lastChild.kind === NodeKind.List) {
        throw new Error("child list has unsupported ListKind");
      } else {
        return ts.createPropertyAccess(
          tsNodeFromNode(restNode) as ts.Expression,
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
        ["parameters", "body"],
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
        undefined,
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
