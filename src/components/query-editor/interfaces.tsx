import { Doc, Path } from "../../logic/interfaces";
import { StructuralSearchQuery } from "../../logic/search/interfaces";

export enum Stage {
  WriteDoc,
  SelectTargetExact,
  QueryReady,
}

export type State = WriteDocState | SelectTargetExactState | QueryReadyState;

export interface WriteDocState {
  stage: Stage.WriteDoc;
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
