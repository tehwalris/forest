import ts from "typescript";
import { StructChild, StructTemplate } from "./legacy-templates/interfaces";

export type UnknownStructTemplate = StructTemplate<
  {
    [key: string]: StructChild<ts.Node>;
  },
  ts.Node
>;

export const allowedGenericNodeMatchers: ((node: ts.Node) => boolean)[] = [
  ts.isConditionalExpression,
  ts.isArrowFunction,
  ts.isVariableStatement,
  ts.isVariableDeclaration,
  ts.isExpressionStatement,
  ts.isForOfStatement,
  ts.isForInStatement,
  ts.isParameter,
  ts.isTypeAliasDeclaration,
  ts.isInterfaceDeclaration,
];
