import { Doc, Path } from "../../logic/interfaces";
import { StructuralSearchQuery } from "../../logic/search/interfaces";

export enum Stage {
  WriteDoc,
  SelectTargetExact,
  Configure,
  QueryReady,
}

export type State =
  | WriteDocState
  | SelectTargetExactState
  | ConfigureState
  | QueryReadyState;

export interface WriteDocState {
  stage: Stage.WriteDoc;
}

export interface SelectTargetExactState {
  stage: Stage.SelectTargetExact;
  doc: Doc;
  roughTarget: Path;
}

export interface ConfigureState {
  stage: Stage.Configure;
  doc: Doc;
  target: Path;
}

export interface QueryReadyState {
  stage: Stage.QueryReady;
  query: StructuralSearchQuery;
}
