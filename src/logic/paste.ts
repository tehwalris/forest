import * as ts from "typescript";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
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

interface FlattenedPasteReplaceArgs extends PasteReplaceArgs {
  clipboard: ListNode;
}

export function canPasteFlattenedIntoTightExpression({
  firstIndex,
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  // TODO this is very restrictive, see canPasteNestedIntoTightExpression
  return clipboard.listKind === ListKind.TightExpression && firstIndex === 0;
}

export function canPasteNestedIntoTightExpression({
  clipboard,
}: PasteReplaceArgs): boolean {
  // TODO this is very restrictive, but other kinds of expressions can only appear on the left side of a TightExpression
  return ts.isIdentifier(tsNodeFromNode(clipboard));
}

export function canPasteNestedIntoLooseExpression({
  clipboard,
}: PasteReplaceArgs): boolean {
  return matchesUnion(tsNodeFromNode(clipboard), unions.Expression);
}

export function canPasteNestedIntoObjectLiteralElement({
  node,
  firstIndex,
  lastIndex,
  clipboard,
}: PasteReplaceArgs): boolean {
  if (firstIndex !== lastIndex) {
    return false;
  }

  switch (tsNodeFromNode(node).kind) {
    case ts.SyntaxKind.PropertyAssignment: {
      if (firstIndex === 0) {
        return ts.isPropertyName(tsNodeFromNode(clipboard));
      } else if (firstIndex === 1) {
        return false;
      } else if (firstIndex === 2) {
        return matchesUnion(tsNodeFromNode(clipboard), unions.Expression);
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    case ts.SyntaxKind.ShorthandPropertyAssignment: {
      if (firstIndex === 0) {
        return ts.isIdentifier(tsNodeFromNode(clipboard));
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    case ts.SyntaxKind.SpreadAssignment: {
      if (firstIndex === 0) {
        return matchesUnion(tsNodeFromNode(clipboard), unions.Expression);
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    default:
      return false;
  }
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

  const canPasteFlattened = (function () {
    if (clipboard.kind !== NodeKind.List) {
      return false;
    }
    const _args: FlattenedPasteReplaceArgs = { ...args, clipboard };
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteFlattenedIntoTightExpression(_args);
      default:
        return false;
    }
  })();

  const canPasteNested = (function () {
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteNestedIntoTightExpression(args);
      case ListKind.LooseExpression:
        return canPasteNestedIntoLooseExpression(args);
      case ListKind.ObjectLiteralElement:
        return canPasteNestedIntoObjectLiteralElement(args);
      default:
        return false;
    }
  })();

  if (canPasteFlattened) {
    if (clipboard.kind !== NodeKind.List) {
      throw new Error(
        "canPasteFlattened === true, but clipboard is not a list",
      );
    }
    const newContent = [...node.content];
    newContent.splice(
      firstIndex,
      lastIndex - firstIndex + 1,
      ...clipboard.content,
    );
    return { ...node, content: newContent };
  } else if (canPasteNested) {
    const newContent = [...node.content];
    newContent.splice(firstIndex, lastIndex - firstIndex + 1, clipboard);
    return { ...node, content: newContent };
  } else {
    console.warn("the requested paste was not explicitly allowed");
    return undefined;
  }
}
