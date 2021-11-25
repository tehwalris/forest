import { Node } from "../interfaces";

export interface StructuralSearchQuery {
  match: (node: Node) => boolean;
}
