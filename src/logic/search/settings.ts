import { ListKind, ListNode, Node, NodeKind, Path } from "../interfaces";
import { PathMap } from "../path-map";
import { nodeGetByPath } from "../tree-utils/access";
import { unreachable } from "../util";
import {
  ListContentMatchKind,
  SearchSettings,
  SearchSettingsKind,
  StructuralSearchQuery,
} from "./interfaces";

function inferSearchSettingsKind(node: Node): SearchSettingsKind {
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
    default:
      return unreachable(kind);
  }
}

function matchFromSettings(
  a: Node,
  b: Node,
  path: Path,
  settingsMap: PathMap<SearchSettings>,
): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === NodeKind.List && b.kind === NodeKind.List) {
    const settings =
      settingsMap.get(path) || getDefaultStructuralSearchSettings(b);
    if (a.listKind !== b.listKind) {
      return false;
    }
    const contentMatchKind =
      settings.kind === SearchSettingsKind.Generic
        ? settings.deep
          ? ListContentMatchKind.Whole
          : ListContentMatchKind.Ignore
        : settings.contentMatch;
    switch (contentMatchKind) {
      case ListContentMatchKind.Whole:
        if (a.content.length !== b.content.length) {
          return false;
        }
        if (
          !a.content.every((ca, i) =>
            matchFromSettings(ca, b.content[i], [...path, i], settingsMap),
          )
        ) {
          return false;
        }
        if (a.structKeys?.length !== b.structKeys?.length) {
          return false;
        }
        if (
          a.structKeys &&
          !a.structKeys.every((ka, i) => ka === b.structKeys![i])
        ) {
          return false;
        }
        break;
      case ListContentMatchKind.Subarray:
        throw new Error("ListContentMatchKind.Subarray: not implemented");
      case ListContentMatchKind.Ignore:
        break;
      default:
        return unreachable(contentMatchKind);
    }
  }
  if (a.tsNode?.kind !== b.tsNode?.kind) {
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
      matchFromSettings(candidateNode, targetNode, targetPath, settingsMap),
  };
}
