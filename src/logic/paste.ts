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

interface NestedPasteReplaceArgs extends PasteReplaceArgs {
  clipboardTs: ts.Node | undefined;
}

export function canPasteFlattenedIntoTightExpression({
  firstIndex,
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  // TODO this is very restrictive, see canPasteNestedIntoTightExpression
  return clipboard.listKind === ListKind.TightExpression && firstIndex === 0;
}

export function canPasteFlattenedIntoCallArguments({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return clipboard.listKind === ListKind.CallArguments;
}

export function canPasteFlattenedIntoTsObjectLiteralExpression({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return (
    clipboard.listKind === ListKind.TsNodeList &&
    clipboard.tsSyntaxKind === ts.SyntaxKind.ObjectLiteralExpression
  );
}

export function canPasteFlattenedIntoTsBlock({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return (
    clipboard.listKind === ListKind.TsNodeList &&
    clipboard.tsSyntaxKind === ts.SyntaxKind.Block
  );
}

export function canPasteNestedIntoTightExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  // TODO this is very restrictive, but other kinds of expressions can only appear on the left side of a TightExpression
  return !!clipboardTs && ts.isIdentifier(clipboardTs);
}

export function canPasteNestedIntoLooseExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && matchesUnion(clipboardTs, unions.Expression);
}

export function canPasteNestedIntoCallArguments({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && matchesUnion(clipboardTs, unions.Expression);
}

export function canPasteNestedIntoObjectLiteralElement({
  node,
  firstIndex,
  lastIndex,
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  if (firstIndex !== lastIndex) {
    return false;
  }
  if (!clipboardTs) {
    return false;
  }

  switch (tsNodeFromNode(node).kind) {
    case ts.SyntaxKind.PropertyAssignment: {
      if (firstIndex === 0) {
        return ts.isPropertyName(clipboardTs);
      } else if (firstIndex === 1) {
        return false;
      } else if (firstIndex === 2) {
        return matchesUnion(clipboardTs, unions.Expression);
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    case ts.SyntaxKind.ShorthandPropertyAssignment: {
      if (firstIndex === 0) {
        return ts.isIdentifier(clipboardTs);
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    case ts.SyntaxKind.SpreadAssignment: {
      if (firstIndex === 0) {
        return matchesUnion(clipboardTs, unions.Expression);
      } else {
        throw new Error("invalid firstIndex");
      }
    }
    default:
      return false;
  }
}

export function canPasteNestedIntoTsObjectLiteralExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && ts.isObjectLiteralElementLike(clipboardTs);
}

export function canPasteNestedIntoTsBlock({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return (
    !!clipboardTs && matchesUnion<ts.Statement>(clipboardTs, unions.Statement)
  );
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

  let clipboardTs: ts.Node | undefined;
  try {
    clipboardTs = tsNodeFromNode(clipboard);
  } catch {}

  const canPasteFlattened = (function () {
    if (clipboard.kind !== NodeKind.List) {
      return false;
    }
    const _args: FlattenedPasteReplaceArgs = { ...args, clipboard };
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteFlattenedIntoTightExpression(_args);
      case ListKind.CallArguments:
        return canPasteFlattenedIntoCallArguments(_args);
      case ListKind.TsNodeList:
        switch (node.tsSyntaxKind) {
          case ts.SyntaxKind.ObjectLiteralExpression:
            return canPasteFlattenedIntoTsObjectLiteralExpression(_args);
          case ts.SyntaxKind.Block:
            return canPasteFlattenedIntoTsBlock(_args);
          default: {
            return false;
          }
        }
      default:
        return false;
    }
  })();

  const canPasteNested = (function () {
    const _args: NestedPasteReplaceArgs = { ...args, clipboardTs };
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteNestedIntoTightExpression(_args);
      case ListKind.LooseExpression:
        return canPasteNestedIntoLooseExpression(_args);
      case ListKind.CallArguments:
        return canPasteNestedIntoCallArguments(_args);
      case ListKind.ObjectLiteralElement:
        return canPasteNestedIntoObjectLiteralElement(_args);
      case ListKind.TsNodeList:
        switch (node.tsSyntaxKind) {
          case ts.SyntaxKind.ObjectLiteralExpression:
            return canPasteNestedIntoTsObjectLiteralExpression(_args);
          case ts.SyntaxKind.Block:
            return canPasteNestedIntoTsBlock(_args);
          default: {
            return false;
          }
        }
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
