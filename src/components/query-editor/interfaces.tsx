import { Doc, Path } from "../../logic/interfaces";
import { StructuralSearchQuery } from "../../logic/search/interfaces";

export enum Stage {
  WriteDoc,
  SelectTargetRough,
  SelectTargetExact,
  QueryReady,
}

export type State =
  | WriteDocState
  | SelectTargetRoughState
  | SelectTargetExactState
  | QueryReadyState;

export interface WriteDocState {
  stage: Stage.WriteDoc;
}

export interface SelectTargetRoughState {
  stage: Stage.SelectTargetRough;
  doc: Doc;
}

export interface SelectTargetExactState {
  stage: Stage.SelectTargetExact;
  doc: Doc;
  roughTarget: Path;
}

export interface QueryReadyState {
  stage: Stage.QueryReady;
  query: StructuralSearchQuery;
}
