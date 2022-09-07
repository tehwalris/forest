import { DocManager } from "../logic/doc-manager";

export interface Example {
  nameParts: string[];
  describedGroups: DescribedGroup[];
}

export interface DescribedGroup {
  description: string;
  label?: string;
  hide?: boolean;
  eventCreators: EventCreator[];
}

export type EventCreator =
  | EventCreatorFromKeys
  | EventCreatorToTypeString
  | EventCreatorFunction;

export enum EventCreatorKind {
  FromKeys,
  ToTypeString,
  Function,
}

export interface EventCreatorFromKeys {
  kind: EventCreatorKind.FromKeys;
  keys: string;
}

export interface EventCreatorToTypeString {
  kind: EventCreatorKind.ToTypeString;
  string: string;
}

export interface EventCreatorFunction {
  kind: EventCreatorKind.Function;
  description: string;
  function: (docManager: DocManager) => void;
}
