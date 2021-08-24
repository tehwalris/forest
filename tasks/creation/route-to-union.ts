// src/logic/transform/transforms/expression-statement.ts

type Union<T> = any;
declare namespace ts {
  type Node = any;
}
var statementUnion: any;
var unions: any;

export function routeToUnion(outerKey: string): {
  route: "Statement" | "Expression";
  key: string;
  union: Union<ts.Node | undefined>;
} {
  if (outerKey.startsWith("Statement.")) {
    return {
      route: "Statement",
      key: outerKey.slice("Statement.".length),
      union: statementUnion,
    };
  } else if (outerKey.startsWith("Expression.")) {
    return {
      route: "Expression",
      key: outerKey.slice("Expression.".length),
      union: unions.Expression,
    };
  } else {
    throw new Error(`unexpected outerKey: ${outerKey}`);
  }
}
