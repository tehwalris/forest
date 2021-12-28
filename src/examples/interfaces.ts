export interface Example {
  name: string;
  describedGroups: DescribedGroup[];
}

export interface DescribedGroup {
  description: string;
  label?: string;
  eventCreators: EventCreator[];
}

export type EventCreator = EventCreatorFromKeys | EventCreatorToTypeString;

export enum EventCreatorKind {
  FromKeys,
  ToTypeString,
}

export interface EventCreatorFromKeys {
  kind: EventCreatorKind.FromKeys;
  keys: string;
}

export interface EventCreatorToTypeString {
  kind: EventCreatorKind.ToTypeString;
  string: string;
}
