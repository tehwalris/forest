import ts from "typescript";
import {
  ListTemplate,
  StructChild,
  StructTemplate,
} from "./legacy-templates/interfaces";

export type UnknownStructTemplate = StructTemplate<
  {
    [key: string]: StructChild<ts.Node>;
  },
  ts.Node
>;

export type UnknownListTemplate = ListTemplate<ts.Node, ts.Node>;

export const allowedGenericNodeMatchers: ((node: ts.Node) => boolean)[] = [
  ts.isConditionalExpression,
  ts.isArrowFunction,
  ts.isVariableStatement,
  ts.isVariableDeclaration,
  ts.isExpressionStatement,
  ts.isForOfStatement,
  ts.isForInStatement,
  ts.isParameter,
  ts.isTypeParameterDeclaration,
  ts.isTypeAliasDeclaration,
  ts.isInterfaceDeclaration,
  ts.isCallSignatureDeclaration,
  ts.isConstructSignatureDeclaration,
  ts.isPropertySignature,
  ts.isMethodSignature,
  ts.isIndexSignatureDeclaration,
  ts.isAsExpression,
  ts.isFunctionDeclaration,
  ts.isFunctionTypeNode,
  ts.isTypeLiteralNode,
  ts.isObjectLiteralExpression,
  ts.isArrayLiteralExpression,
];
