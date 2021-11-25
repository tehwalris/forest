import { ListKind, Node, NodeKind } from "../interfaces";
import { unreachable } from "../util";
import {
  ListContentMatchKind,
  SearchSettings,
  SearchSettingsKind,
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
