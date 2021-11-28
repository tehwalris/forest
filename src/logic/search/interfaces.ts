import { Node } from "../interfaces";

export interface StructuralSearchQuery {
  match: (node: Node) => boolean;
}

export enum SearchSettingsKind {
  Generic,
  List,
  Text,
}

export type SearchSettings =
  | GenericSearchSettings
  | ListSearchSettings
  | TextSearchSettings;

export interface GenericSearchSettings {
  kind: SearchSettingsKind.Generic;
  deep: boolean;
}

export enum ListContentMatchKind {
  Whole = "Whole",
  Ignore = "Ignore",
}

export interface ListSearchSettings {
  kind: SearchSettingsKind.List;
  contentMatch: ListContentMatchKind;
}

export interface TextSearchSettings {
  kind: SearchSettingsKind.Text;
  exactMatch: boolean;
  satisfyingExpression?: string;
}

export interface SearchExecutionSettings {
  shallowSearchForRoot: boolean;
}
