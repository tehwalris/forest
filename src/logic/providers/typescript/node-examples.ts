export const nodeExamples = new Map<string, string>([
  ["ClassDeclaration", "class SomeClass { ... }"],
  ["IfStatement", "if (...) { ... }"],
  ["ReturnStatement", "return ..."],
  ["FunctionDeclaration", "function foo() { ... }"],
  ["ArrowFunction", "x => x + 1"],
  ["BinaryExpression", "a === b"],
  ["CallExpression", "foo()"],
  ["Block", "{ ... }"],
  ["PropertyAccessExpression", "foo.bar"],
  ["VariableStatement", "var x = 123"],
  ["VariableDeclarationList", "var x = 123"],
  ["InterfaceDeclaration", "interface Person { ... }"],
  ["TypeAliasDeclaration", "type Action = ..."],
  ["EnumDeclaration", "enum Modes { ... }"],
  ["ImportDeclaration", 'import { useEffect } from "React"'],
  ["ExportDeclaration", "export { myFunction }"],
  ["DoStatement", "do { ... } while (!empty)"],
  ["WhileStatement", "while (!empty) { ... }"],
  ["ForStatement", "for (let i = 0; i < 10; i++) { ... }"],
  ["ForInStatement", "for (const property in object) { ... }"],
  ["ForOfStatement", "for (const user of users) { ... }"],
  ["ThrowStatement", "throw new Error(...)"],
  ["TryStatement", "try { ... } catch (error) { ... }"],
  ["Identifier", "someVariable"],
  ["NumericLiteral", "123"],
  ["StringLiteral", '"a string"'],
  ["RegularExpressionLiteral", "/^[a-z]+/"],
  ["ThisExpression", "this"],
  ["SuperExpression", "super"],
  ["FunctionExpression", "function () { ... }"],
  ["NullLiteral", "null"],
  ["ArrayLiteralExpression", '["red", "green"]'],
  ["ObjectLiteralExpression", '{ name: "Julia", age: 35 }'],
  ["ParenthesizedExpression", "(...)"],
  ["NewExpression", "new Date()"],
  ["ElementAccessExpression", "listItems[0]"],
  ["PrefixUnaryExpression", "!empty"],
  ["PostfixUnaryExpression", "i++"],
  ["TypeOfExpression", "typeof response"],
  ["AwaitExpression", "await fetch(...)"],
  ["ConditionalExpression", 'items.length ? items : "no items"'],
  ["AsExpression", "[] as string[]"],
  ["SpreadElement", "...extraArguments"],
  ["TrueLiteral", "true"],
  ["FalseLiteral", "false"],
  ["AnyKeyword", "any"],
  ["UnknownKeyword", "unknown"],
  ["NumberKeyword", "number"],
  ["ObjectKeyword", "object"],
  ["BooleanKeyword", "boolean"],
  ["StringKeyword", "string"],
  ["SymbolKeyword", "symbol"],
  ["ThisKeyword", "this"],
  ["VoidKeyword", "void"],
  ["UndefinedKeyword", "undefined"],
  ["NullKeyword", "null"],
  ["NeverKeyword", "never"],
  ["TypeLiteralNode", "{ name: string, age: number }"],
  ["FunctionTypeNode", "(v: number) => number"],
  ["ConstructorTypeNode", "new (name: string, age: number)"],
  ["TypeReferenceNode", "Set<string>"],
  ["ArrayTypeNode", "string[]"],
  ["TupleTypeNode", "[string, string, number]"],
  ["ParenthesizedTypeNode", "(...)"],
  ["UnionTypeNode", "string | number"],
  ["IntersectionTypeNode", "ExampleAction & Printable"],
  ["LiteralTypeNode", '"red"'],
  ["PropertyAssignment", 'name: "Julia"'],
  ["ShorthandPropertyAssignment", "age"],
  ["SpreadAssignment", "...extraArguments"],
  ["MethodDeclaration", "private getLabel(...): string { ... }"],
  ["GetAccessorDeclaration", "get label(): string { ... }"],
  ["SetAccessorDeclaration", "set label(newLabel: string) { ... }"],
  ["PropertyDeclaration", "items: number[] = []"],
]);
