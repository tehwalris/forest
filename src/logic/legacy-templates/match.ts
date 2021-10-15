import * as ts from "typescript";
import { Union } from "./interfaces";

export function matchesUnion<T extends ts.Node>(
  node: ts.Node,
  union: Union<T>,
): node is T {
  return [...Object.values(union.getMembers())].some((m) => m.match(node));
}
