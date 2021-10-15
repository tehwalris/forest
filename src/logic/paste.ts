import * as ts from "typescript";
import { ListKind, ListNode, Node } from "./interfaces";
import { matchesUnion } from "./legacy-templates/match";
import { unions } from "./legacy-templates/templates";
import { tsNodeFromNode } from "./ts-from-node";

export function acceptPasteRoot(clipboard: Node): ListNode | undefined {
  return undefined;
}

interface PasteReplaceArgs {
  node: ListNode;
  firstIndex: number;
  lastIndex: number;
  clipboard: Node;
}

export function canPasteIntoTightExpression({
  clipboard,
}: PasteReplaceArgs): boolean {
  // TODO this is very restrictive, but other kinds of expressions can only appear on the left side of a TightExpression
  return ts.isIdentifier(tsNodeFromNode(clipboard));
}

export function canPasteIntoLooseExpression({
  clipboard,
}: PasteReplaceArgs): boolean {
  return matchesUnion(tsNodeFromNode(clipboard), unions.Expression);
}

export function acceptPasteReplace(
  args: PasteReplaceArgs,
): ListNode | undefined {
  const { node, firstIndex, lastIndex, clipboard } = args;

  if (
    !(
      firstIndex >= 0 &&
      firstIndex <= lastIndex &&
      lastIndex < node.content.length
    )
  ) {
    throw new Error("invalid indices");
  }
  if (firstIndex !== lastIndex) {
    console.warn("TODO pasting over multiple items is not supported yet");
    return undefined;
  }

  const canPaste = (function () {
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteIntoTightExpression(args);
      case ListKind.LooseExpression:
        return canPasteIntoLooseExpression(args);
      default:
        return false;
    }
  })();

  if (!canPaste) {
    console.warn("the requested paste was not explicitly allowed");
    return undefined;
  }

  const newContent = [...node.content];
  newContent.splice(firstIndex, lastIndex - firstIndex + 1, clipboard);
  return { ...node, content: newContent };
}
