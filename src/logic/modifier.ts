import ts from "typescript";
import { ListNode } from "./interfaces";
import { getStructContent } from "./struct";
import { tsNodeFromNode } from "./ts-from-node";
export function isModifierKey(key: string): boolean {
  return !!key.match(/^modifiers\[(\d+)\]$/);
}
export function getModifierSyntaxKinds(
  node: ListNode,
): ts.ModifierSyntaxKind[] {
  const content = getStructContent(node, node.structKeys || [], []);
  const modifierKeys = (node.structKeys || []).filter((k) => isModifierKey(k));
  return modifierKeys.map((k) => {
    const modifierNode = content[k];
    const modifierTsNode = tsNodeFromNode(modifierNode);
    if (!ts.isModifier(modifierTsNode)) {
      throw new Error("not a modifier");
    }
    return modifierTsNode.kind;
  });
}
