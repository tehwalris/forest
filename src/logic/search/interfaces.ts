import { Node } from "../interfaces";

export interface StructuralSearchQuery {
  match: (node: Node) => boolean;
}

export enum SearchSettingsKind {
  Generic,
  List,
}

export type SearchSettings = GenericSearchSettings | ListSearchSettings;

export interface GenericSearchSettings {
  kind: SearchSettingsKind.Generic;
  deep: boolean;
}

export enum ListContentMatchKind {
  Whole,
  Subarray,
  Ignore,
}

export interface ListSearchSettings {
  kind: SearchSettingsKind.List;
  contentMatch: ListContentMatchKind;
}
