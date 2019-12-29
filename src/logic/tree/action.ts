import { Node } from "./node";
export enum InputKind {
  None,
  String,
  OneOf,
  Child,
}
export type Action<N extends Node<unknown>> =
  | NoInputAction<N>
  | StringInputAction<N>
  | OneOfInputAction<N, any>
  | ChildInputAction<N>;
export interface NoInputAction<N extends Node<unknown>> {
  inputKind: InputKind.None;
  apply(): N;
}
export interface StringInputAction<N extends Node<unknown>> {
  inputKind: InputKind.String;
  apply(input: string): N;
}
export interface OneOfInputAction<N extends Node<unknown>, T> {
  inputKind: InputKind.OneOf;
  oneOf: T[];
  getLabel(value: T): string;
  getShortcut(value: T): string | undefined;
  apply(input: T): N;
}
export interface ChildInputAction<N extends Node<unknown>> {
  inputKind: InputKind.Child;
  apply(selectedChildKey: string): N;
}
export interface ActionSet<N extends Node<unknown>> {
  // TODO
  prepend?: NoInputAction<N>;
  append?: NoInputAction<N>;
  setFromString?: StringInputAction<N>;
  setVariant?: OneOfInputAction<N, {}>;
  toggle?: NoInputAction<N>;
  insertByKey?: StringInputAction<N>;
  deleteByKey?: StringInputAction<N>;
  deleteChild?: ChildInputAction<N>;
  [key: string]: Action<N> | undefined;
}
export function mergeActionSets<N extends Node<unknown>>(
  bottom: ActionSet<N>,
  top: ActionSet<N>,
): ActionSet<N> {
  return { ...bottom, ...top };
}
