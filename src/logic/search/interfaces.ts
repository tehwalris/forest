import { Node } from "../interfaces";

export interface StructuralSearchQuery {
  match: (node: Node) => boolean;
}

export interface StructuralSearchSettings {
  deep: boolean;
}
