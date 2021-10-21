import * as ts from "typescript";
import {
  allowedGenericNodeMatchers,
  UnknownStructTemplate,
} from "./generic-node";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { matchesUnion } from "./legacy-templates/match";
import { structTemplates, unions } from "./legacy-templates/templates";
import { nodeFromTsNode } from "./node-from-ts";
import { tsNodeFromNode } from "./ts-from-node";

export function acceptPasteRoot(clipboard: Node): ListNode | undefined {
  return acceptPasteReplace({
    clipboard,
    firstIndex: 0,
    lastIndex: 0,
    node: {
      kind: NodeKind.List,
      listKind: ListKind.File,
      delimiters: ["", ""],
      content: [nodeFromTsNode(ts.createEmptyStatement(), undefined)],
      equivalentToContent: true,
      pos: 0,
      end: 0,
    },
  });
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
    clipboard.tsNode?.kind === ts.SyntaxKind.ObjectLiteralExpression
  );
}

export function canPasteFlattenedIntoTsBlockOrFile({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return (
    (clipboard.listKind === ListKind.TsNodeList &&
      clipboard.tsNode?.kind === ts.SyntaxKind.Block) ||
    clipboard.listKind === ListKind.File
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

export function canPasteNestedIntoParenthesizedExpression({
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

export function canPasteNestedIntoTsBlockOrFile({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return (
    !!clipboardTs && matchesUnion<ts.Statement>(clipboardTs, unions.Statement)
  );
}

function canPasteNestedIntoGenericTsNode({
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

  const oldTsNode = node.tsNode;
  if (!oldTsNode || !allowedGenericNodeMatchers.find((m) => m(oldTsNode))) {
    return false;
  }

  const structTemplate: UnknownStructTemplate | undefined =
    structTemplates.find((t) => t.match(oldTsNode)) as any;
  if (!structTemplate) {
    return false;
  }

  const templateChildren = structTemplate.load(oldTsNode);

  const structKey = node.structKeys?.[firstIndex];
  if (!structKey) {
    throw new Error("firstIndex does not point to a valid structKey");
  }

  if (templateChildren[structKey].isList) {
    return false;
  }

  return matchesUnion(clipboardTs, templateChildren[structKey].union);
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
        switch (node.tsNode?.kind) {
          case ts.SyntaxKind.ObjectLiteralExpression:
            return canPasteFlattenedIntoTsObjectLiteralExpression(_args);
          case ts.SyntaxKind.Block:
            return canPasteFlattenedIntoTsBlockOrFile(_args);
          default: {
            return false;
          }
        }
      case ListKind.File:
        return canPasteFlattenedIntoTsBlockOrFile(_args);
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
      case ListKind.ParenthesizedExpression:
        return canPasteNestedIntoParenthesizedExpression(_args);
      case ListKind.CallArguments:
        return canPasteNestedIntoCallArguments(_args);
      case ListKind.ObjectLiteralElement:
        return canPasteNestedIntoObjectLiteralElement(_args);
      case ListKind.TsNodeStruct:
        return canPasteNestedIntoGenericTsNode(_args);
      case ListKind.TsNodeList:
        switch (node.tsNode?.kind) {
          case ts.SyntaxKind.ObjectLiteralExpression:
            return canPasteNestedIntoTsObjectLiteralExpression(_args);
          case ts.SyntaxKind.Block:
            return canPasteNestedIntoTsBlockOrFile(_args);
          default: {
            return false;
          }
        }
      case ListKind.File:
        return canPasteNestedIntoTsBlockOrFile(_args);
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
  } else if (!!clipboardTs && matchesUnion(clipboardTs, unions.Expression)) {
    return acceptPasteReplace({
      ...args,
      clipboard: {
        kind: NodeKind.List,
        listKind: ListKind.TsNodeStruct,
        tsNode: ts.createExpressionStatement(ts.createIdentifier("")),
        delimiters: ["", ""],
        structKeys: ["expression"],
        content: [clipboard],
        equivalentToContent: true,
        pos: clipboard.pos,
        end: clipboard.end,
      },
    });
  } else {
    console.warn("the requested paste was not explicitly allowed");
    return undefined;
  }
}
