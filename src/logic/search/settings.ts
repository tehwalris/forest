import ts from "typescript";
import { ListKind, ListNode, Node, NodeKind, Path } from "../interfaces";
import { PathMap } from "../path-map";
import { nodeGetByPath } from "../tree-utils/access";
import { isToken } from "../ts-type-predicates";
import { unreachable } from "../util";
import {
  ListContentMatchKind,
  SearchSettings,
  SearchSettingsKind,
  StructuralSearchQuery,
} from "./interfaces";

function inferSearchSettingsKind(node: Node): SearchSettingsKind {
  if (isToken(node, ts.isIdentifier) || isToken(node, ts.isStringLiteral)) {
    return SearchSettingsKind.Text;
  }
  if (
    node.kind === NodeKind.List &&
    [
      ListKind.TightExpression,
      ListKind.LooseExpression,
      ListKind.CallArguments,
      ListKind.TypeArguments,
      ListKind.IfBranches,
      ListKind.ObjectLiteralElement,
      ListKind.UnknownTsNodeArray,
      ListKind.TsNodeList,
      ListKind.File,
    ].includes(node.listKind)
  ) {
    return SearchSettingsKind.List;
  }
  return SearchSettingsKind.Generic;
}

export function getDefaultStructuralSearchSettings(node: Node): SearchSettings {
  const kind = inferSearchSettingsKind(node);
  switch (kind) {
    case SearchSettingsKind.Generic:
      return { kind, deep: true };
    case SearchSettingsKind.List:
      return { kind, contentMatch: ListContentMatchKind.Whole };
    case SearchSettingsKind.Text:
      return { kind, exactMatch: true };
    default:
      return unreachable(kind);
  }
}

function getTextFromNode(node: Node): string | undefined {
  const tsNode = node.tsNode;
  if (!tsNode) {
    return undefined;
  }
  if (!("text" in tsNode && typeof (tsNode as any).text === "string")) {
    return undefined;
  }
  return (tsNode as any).text;
}

type StringPredicate = (s: string) => boolean;
type StringPredicateCache = Map<string, StringPredicate>;

function compileStringPredicate(
  expression: string,
  cache: StringPredicateCache,
): StringPredicate {
  if (cache.has(expression)) {
    return cache.get(expression)!;
  }
  const _f: (s: string) => unknown = new Function(
    "s",
    `return (${expression})`,
  ) as any;
  const f: StringPredicate = (text) => {
    const result = _f(text);
    if (typeof result !== "boolean") {
      throw new Error("result is not a boolean");
    }
    return result;
  };
  cache.set(expression, f);
  return f;
}

function matchFromSettings(
  aCandidate: Node,
  bTarget: Node,
  path: Path,
  settingsMap: PathMap<SearchSettings>,
  stringPredicateCache: StringPredicateCache,
): boolean {
  if (aCandidate.kind !== bTarget.kind) {
    return false;
  }
  const settings =
    settingsMap.get(path) || getDefaultStructuralSearchSettings(bTarget);
  if (aCandidate.kind === NodeKind.List && bTarget.kind === NodeKind.List) {
    if (aCandidate.listKind !== bTarget.listKind) {
      return false;
    }
    let contentMatchKind = ListContentMatchKind.Whole;
    switch (settings.kind) {
      case SearchSettingsKind.Generic:
        if (!settings.deep) {
          contentMatchKind = ListContentMatchKind.Ignore;
        }
        break;
      case SearchSettingsKind.List:
        contentMatchKind = settings.contentMatch;
        break;
      case SearchSettingsKind.Text:
        throw new Error(
          "NodeKind.List and SearchSettingsKind.Text can not be combined",
        );
      default:
        return unreachable(settings);
    }
    switch (contentMatchKind) {
      case ListContentMatchKind.Whole:
        if (aCandidate.content.length !== bTarget.content.length) {
          return false;
        }
        if (
          !aCandidate.content.every((ca, i) =>
            matchFromSettings(
              ca,
              bTarget.content[i],
              [...path, i],
              settingsMap,
              stringPredicateCache,
            ),
          )
        ) {
          return false;
        }
        if (aCandidate.structKeys?.length !== bTarget.structKeys?.length) {
          return false;
        }
        if (
          aCandidate.structKeys &&
          !aCandidate.structKeys.every((ka, i) => ka === bTarget.structKeys![i])
        ) {
          return false;
        }
        break;
      case ListContentMatchKind.Ignore:
        break;
      default:
        return unreachable(contentMatchKind);
    }
  }
  if (
    aCandidate.kind === NodeKind.Token &&
    bTarget.kind === NodeKind.Token &&
    settings.kind === SearchSettingsKind.Text
  ) {
    if (settings.exactMatch && settings.satisfyingExpression !== undefined) {
      throw new Error(
        "only one of exactMatch and satisfyingExpression may be set",
      );
    }
    const aText = getTextFromNode(aCandidate);
    const bText = getTextFromNode(bTarget);
    if (bText === undefined) {
      throw new Error("target node does not have text");
    }
    if (aText === undefined) {
      return false;
    }
    if (settings.exactMatch) {
      if (aText !== bText) {
        return false;
      }
    }
    if (settings.satisfyingExpression !== undefined) {
      const predicate = compileStringPredicate(
        settings.satisfyingExpression,
        stringPredicateCache,
      );
      if (!predicate(aText)) {
        return false;
      }
    }
  }
  if (aCandidate.tsNode?.kind !== bTarget.tsNode?.kind) {
    return false;
  }
  return true;
}

export function makeQueryFromSettings(
  root: ListNode,
  targetPath: Path,
  settingsMap: PathMap<SearchSettings>,
): StructuralSearchQuery {
  const targetNode = nodeGetByPath(root, targetPath);
  if (!targetNode) {
    throw new Error("invalid targetPath");
  }
  return {
    match: (candidateNode) =>
      matchFromSettings(
        candidateNode,
        targetNode,
        targetPath,
        settingsMap,
        new Map(),
      ),
  };
}
