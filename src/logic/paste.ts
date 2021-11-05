import * as ts from "typescript";
import {
  allowedGenericNodeMatchers,
  UnknownListTemplate,
  UnknownStructTemplate,
} from "./generic-node";
import { ListKind, ListNode, Node, NodeKind } from "./interfaces";
import { StructChild } from "./legacy-templates/interfaces";
import { matchesUnion } from "./legacy-templates/match";
import {
  listTemplates,
  structTemplates,
  unions,
} from "./legacy-templates/templates";
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

export interface PasteReplaceArgs {
  node: ListNode;
  parent?: {
    node: ListNode;
    childIndex: number;
  };
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

function canPasteFlattenedIntoTightExpression({
  firstIndex,
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  // TODO this is very restrictive, see canPasteNestedIntoTightExpression
  return clipboard.listKind === ListKind.TightExpression && firstIndex === 0;
}

function canPasteFlattenedIntoCallArguments({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return clipboard.listKind === ListKind.CallArguments;
}

function canPasteFlattenedIntoGenericTsNodeChildList({
  parent,
  node,
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  if (clipboard.listKind !== ListKind.UnknownTsNodeArray) {
    return false;
  }
  return clipboard.content.every((clipboardChild) => {
    let clipboardChildTs: ts.Node | undefined;
    try {
      clipboardChildTs = tsNodeFromNode(clipboardChild);
    } catch {}
    return canPasteNestedIntoGenericTsNodeStructChildList({
      parent,
      node,
      clipboard: clipboardChild,
      clipboardTs: clipboardChildTs,
      firstIndex: 0,
      lastIndex: 0,
    });
  });
}

function canPasteFlattenedIntoTsBlockOrFile({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return (
    (clipboard.listKind === ListKind.TsNodeList &&
      clipboard.tsNode?.kind === ts.SyntaxKind.Block) ||
    clipboard.listKind === ListKind.File
  );
}

function canPasteNestedIntoTightExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  // TODO this is very restrictive, but other kinds of expressions can only appear on the left side of a TightExpression
  return !!clipboardTs && ts.isIdentifier(clipboardTs);
}

function canPasteNestedIntoLooseExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && matchesUnion(clipboardTs, unions.Expression);
}

function canPasteNestedIntoParenthesizedExpression({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && matchesUnion(clipboardTs, unions.Expression);
}

function canPasteNestedIntoCallArguments({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return !!clipboardTs && matchesUnion(clipboardTs, unions.Expression);
}

function canPasteNestedIntoObjectLiteralElement({
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

function canPasteNestedIntoTsBlockOrFile({
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  return (
    !!clipboardTs && matchesUnion<ts.Statement>(clipboardTs, unions.Statement)
  );
}

function tryGetTemplateChildForGenericTsNodeStruct(
  node: ListNode,
  childIndex: number,
): StructChild<ts.Node> | undefined {
  const oldTsNode = node.tsNode;
  if (!oldTsNode || !allowedGenericNodeMatchers.find((m) => m(oldTsNode))) {
    return undefined;
  }

  const structTemplate: UnknownStructTemplate | undefined =
    structTemplates.find((t) => t.match(oldTsNode)) as any;
  if (!structTemplate) {
    return undefined;
  }

  const templateChildren = structTemplate.load(oldTsNode);

  const structKey = node.structKeys?.[childIndex];
  if (!structKey) {
    throw new Error("childIndex does not point to a valid structKey");
  }

  return templateChildren[structKey];
}

function tryGetTemplateForGenericTsNodeList(
  node: ListNode,
): UnknownListTemplate | undefined {
  const oldTsNode = node.tsNode;
  if (!oldTsNode || !allowedGenericNodeMatchers.find((m) => m(oldTsNode))) {
    return undefined;
  }

  const listTemplate: UnknownListTemplate | undefined = listTemplates.find(
    (t) => t.match(oldTsNode),
  ) as any;
  return listTemplate;
}

function canPasteNestedIntoGenericTsNodeStruct({
  node,
  firstIndex,
  lastIndex,
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  if (firstIndex !== lastIndex || !clipboardTs) {
    return false;
  }
  const templateChild = tryGetTemplateChildForGenericTsNodeStruct(
    node,
    firstIndex,
  );
  if (!templateChild || templateChild.isList) {
    return false;
  }
  return matchesUnion(clipboardTs, templateChild.union);
}

function canPasteNestedIntoGenericTsNodeStructChildList({
  parent,
  firstIndex,
  lastIndex,
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  if (firstIndex !== lastIndex || !clipboardTs || !parent) {
    return false;
  }
  const templateChild = tryGetTemplateChildForGenericTsNodeStruct(
    parent.node,
    parent.childIndex,
  );
  if (!templateChild || !templateChild.isList) {
    return false;
  }
  return matchesUnion(clipboardTs, templateChild.union);
}

function canPasteNestedIntoGenericTsNodeList({
  node,
  firstIndex,
  lastIndex,
  clipboardTs,
}: NestedPasteReplaceArgs): boolean {
  if (firstIndex !== lastIndex || !clipboardTs) {
    return false;
  }
  const listTemplate = tryGetTemplateForGenericTsNodeList(node);
  if (!listTemplate) {
    return false;
  }
  return matchesUnion(clipboardTs, listTemplate.childUnion);
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
      case ListKind.UnknownTsNodeArray:
        return canPasteFlattenedIntoGenericTsNodeChildList(_args);
      case ListKind.TsNodeList:
        switch (node.tsNode?.kind) {
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
      case ListKind.UnknownTsNodeArray:
        return canPasteNestedIntoGenericTsNodeStructChildList(_args);
      case ListKind.TsNodeStruct:
        return canPasteNestedIntoGenericTsNodeStruct(_args);
      case ListKind.TsNodeList:
        switch (node.tsNode?.kind) {
          case ts.SyntaxKind.Block:
            return canPasteNestedIntoTsBlockOrFile(_args);
          default: {
            return canPasteNestedIntoGenericTsNodeList(_args);
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
