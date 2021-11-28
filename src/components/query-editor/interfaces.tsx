import { Doc, Path } from "../../logic/interfaces";
import {
  SearchExecutionSettings,
  StructuralSearchQuery,
} from "../../logic/search/interfaces";

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
  executionSettings: SearchExecutionSettings;
}

export interface QueryReadyState {
  stage: Stage.QueryReady;
  query: StructuralSearchQuery;
  executionSettings: SearchExecutionSettings;
}
