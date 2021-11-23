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
import { ListItemReplacement } from "./replace-multiple";
import { tsNodeFromNode } from "./ts-from-node";
import {
  isToken,
  isTsExclamationToken,
  isTsPostfixUnaryOperatorTokenWithExpectedParent,
  isTsPrefixUnaryOperatorTokenWithExpectedParent,
  isTsQuestionDotToken,
} from "./ts-type-predicates";
export function acceptPasteRoot(
  clipboard: Clipboard,
): ListItemReplacement | undefined {
  const replacement = acceptPasteReplace({
    clipboard: clipboard.node,
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
      id: Symbol(),
    },
    isPartialCopy: clipboard.isPartialCopy,
  });
  if (!replacement) {
    return undefined;
  }
  return { content: replacement.content, range: { anchor: [], offset: 0 } };
}
export interface Clipboard {
  node: Node;
  isPartialCopy: boolean;
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
  isPartialCopy: boolean;
  disableConversions?: boolean;
}
interface FlattenedPasteReplaceArgs extends PasteReplaceArgs {
  clipboard: ListNode;
}
interface NestedPasteReplaceArgs extends PasteReplaceArgs {
  clipboardTs: ts.Node | undefined;
}
function isValidTightExpressionChild(c: Node): unknown {
  if (
    (c.kind === NodeKind.List &&
      (c.listKind === ListKind.CallArguments ||
        c.listKind === ListKind.TypeArguments ||
        c.listKind === ListKind.ElementAccessExpressionArgument ||
        c.listKind === ListKind.ParenthesizedExpression)) ||
    isToken(c, ts.isIdentifier) ||
    isToken(c, isTsQuestionDotToken) ||
    isToken(c, isTsExclamationToken) ||
    isToken(c, isTsPrefixUnaryOperatorTokenWithExpectedParent) ||
    isToken(c, isTsPostfixUnaryOperatorTokenWithExpectedParent)
  ) {
    return true;
  }
  try {
    return matchesUnion(tsNodeFromNode(c), unions.LeftHandSideExpression);
  } catch {
    return false;
  }
}
function isTightExpressionContentValid(content: Node[]): boolean {
  {
    let parenthesizedExpressionAllowed = true;
    for (const c of content) {
      if (
        c.kind === NodeKind.List &&
        c.listKind === ListKind.ParenthesizedExpression
      ) {
        if (!parenthesizedExpressionAllowed) {
          return false;
        }
        parenthesizedExpressionAllowed = false;
      } else if (isToken(c, ts.isIdentifier)) {
        parenthesizedExpressionAllowed = false;
      }
    }
  }
  return (
    !!content.length && content.every((c) => isValidTightExpressionChild(c))
  );
}
function makeCanPasteFlattenedFromCanPasteNested(
  canPasteNested: (args: NestedPasteReplaceArgs) => boolean,
): (args: FlattenedPasteReplaceArgs) => boolean {
  return (args) => {
    const { node, clipboard } = args;
    return clipboard.content.every((clipboardChild) => {
      let clipboardChildTs: ts.Node | undefined;
      try {
        clipboardChildTs = tsNodeFromNode(clipboardChild);
      } catch {}
      return canPasteNested({
        node: { ...node, content: node.content.slice(0, 1) },
        clipboard: clipboardChild,
        clipboardTs: clipboardChildTs,
        firstIndex: 0,
        lastIndex: 0,
        isPartialCopy: false,
      });
    });
  };
}
function canPasteFlattenedIntoTightExpression(
  args: FlattenedPasteReplaceArgs,
): boolean {
  const { firstIndex, lastIndex, node, clipboard } = args;
  if (
    clipboard.listKind !== ListKind.TightExpression &&
    !makeCanPasteFlattenedFromCanPasteNested(canPasteNestedIntoTightExpression)(
      args,
    )
  ) {
    return false;
  }
  const newContent = [...node.content];
  newContent.splice(
    firstIndex,
    lastIndex - firstIndex + 1,
    ...clipboard.content,
  );
  return isTightExpressionContentValid(newContent);
}
function canPasteFlattenedIntoLooseExpression({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return clipboard.listKind === ListKind.LooseExpression;
}
function canPasteFlattenedIntoCallArguments({
  clipboard,
}: FlattenedPasteReplaceArgs): boolean {
  return clipboard.listKind === ListKind.CallArguments;
}
function canPasteFlattenedIntoGenericTsNodeChildList(
  args: FlattenedPasteReplaceArgs,
): boolean {
  const { clipboard } = args;
  if (clipboard.listKind !== ListKind.UnknownTsNodeArray) {
    return false;
  }
  return makeCanPasteFlattenedFromCanPasteNested(
    canPasteNestedIntoGenericTsNodeStructChildList,
  )(args);
}
function canPasteFlattenedIntoGenericTsNodeList(
  args: FlattenedPasteReplaceArgs,
): boolean {
  const { node, clipboard } = args;
  if (
    node.listKind === ListKind.TsNodeList &&
    clipboard.listKind === ListKind.TsNodeList &&
    node.tsNode &&
    clipboard.tsNode &&
    node.tsNode.kind === clipboard.tsNode.kind
  ) {
    return true;
  }
  return makeCanPasteFlattenedFromCanPasteNested(
    canPasteNestedIntoGenericTsNodeList,
  )(args);
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
  firstIndex,
  lastIndex,
  node,
  clipboard,
}: NestedPasteReplaceArgs): boolean {
  const newContent = [...node.content];
  newContent.splice(firstIndex, lastIndex - firstIndex + 1, clipboard);
  return isTightExpressionContentValid(newContent);
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
): ListItemReplacement | undefined {
  const {
    node,
    firstIndex,
    lastIndex,
    clipboard,
    isPartialCopy,
    disableConversions = false,
  } = args;
  if (
    !(
      firstIndex >= 0 &&
      firstIndex <= lastIndex &&
      lastIndex < node.content.length
    )
  ) {
    throw new Error("invalid indices");
  }
  let clipboardTs: ts.Node | undefined;
  try {
    clipboardTs = tsNodeFromNode(clipboard);
  } catch {}
  const canPasteFlattened = (function () {
    if (
      clipboard.kind !== NodeKind.List ||
      (!clipboard.equivalentToContent && !isPartialCopy)
    ) {
      return false;
    }
    const _args: FlattenedPasteReplaceArgs = { ...args, clipboard };
    switch (node.listKind) {
      case ListKind.TightExpression:
        return canPasteFlattenedIntoTightExpression(_args);
      case ListKind.LooseExpression:
        return canPasteFlattenedIntoLooseExpression(_args);
      case ListKind.CallArguments:
        return canPasteFlattenedIntoCallArguments(_args);
      case ListKind.UnknownTsNodeArray:
        return canPasteFlattenedIntoGenericTsNodeChildList(_args);
      case ListKind.TsNodeList:
        switch (node.tsNode?.kind) {
          case ts.SyntaxKind.Block:
            return canPasteFlattenedIntoTsBlockOrFile(_args);
          default: {
            return canPasteFlattenedIntoGenericTsNodeList(_args);
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
  if (canPasteFlattened && (!canPasteNested || isPartialCopy)) {
    if (clipboard.kind !== NodeKind.List) {
      throw new Error(
        "canPasteFlattened === true, but clipboard is not a list",
      );
    }
    return {
      range: { anchor: [firstIndex], offset: lastIndex - firstIndex },
      content: clipboard.content,
      structKeys: clipboard.structKeys,
    };
  } else if (canPasteNested) {
    return {
      range: { anchor: [firstIndex], offset: lastIndex - firstIndex },
      content: [clipboard],
      structKeys: node.structKeys?.slice(firstIndex, lastIndex + 1),
    };
  } else {
    const conversionResults: (ListItemReplacement | undefined)[] = [];
    if (!disableConversions) {
      if (!!clipboardTs && matchesUnion(clipboardTs, unions.Expression)) {
        conversionResults.push(
          acceptPasteReplace({
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
              id: Symbol(),
            },
            disableConversions: true,
          }),
        );
      }
      if (!!clipboardTs && ts.isIdentifier(clipboardTs)) {
        conversionResults.push(
          acceptPasteReplace({
            ...args,
            clipboard: {
              kind: NodeKind.List,
              listKind: ListKind.TsNodeStruct,
              tsNode: ts.factory.createTypeReferenceNode(clipboardTs),
              delimiters: ["", ""],
              structKeys: ["typeName"],
              content: [clipboard],
              equivalentToContent: true,
              pos: clipboard.pos,
              end: clipboard.end,
              id: Symbol(),
            },
            disableConversions: true,
          }),
        );
      }
    }
    const firstGoodConversion = conversionResults.filter((c) => c)[0];
    if (firstGoodConversion) {
      return firstGoodConversion;
    }
    return undefined;
  }
}
