import { Node } from "../interfaces";
import { unreachable } from "../util";
import {
  ListContentMatchKind,
  SearchSettings,
  SearchSettingsKind,
} from "./interfaces";

function inferSearchSettingsKind(node: Node): SearchSettingsKind {
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
