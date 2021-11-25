import { Node } from "../interfaces";
import { StructuralSearchSettings } from "./interfaces";

export function getDefaultStructuralSearchSettings(
  node: Node,
): StructuralSearchSettings {
  return { deep: true };
}
