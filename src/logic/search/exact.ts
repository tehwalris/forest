import { Node } from "../interfaces";
import { StructuralSearchQuery } from "./interfaces";

export function makeExactMatchQuery(node: Node): StructuralSearchQuery {
  // TODO
  return { match: () => true };
}
