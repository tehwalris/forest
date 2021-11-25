import { Doc, Path } from "../../logic/interfaces";

export enum Stage {
  WriteDoc,
  SelectTargetRough,
  SelectTargetExact,
}

export type State =
  | WriteDocState
  | SelectTargetRoughState
  | SelectTargetExactState;

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
