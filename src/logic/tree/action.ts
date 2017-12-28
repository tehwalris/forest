import { Node } from "./node";
export enum InputKind {
  None,
  String,
  OneOf,
  Child
}
export type Action<N extends Node<{}>> =
  | NoInputAction<N>
  | StringInputAction<N>
  | OneOfInputAction<N, any>
  | ChildInputAction<N>;
export interface NoInputAction<N extends Node<{}>> {
  inputKind: InputKind.None;
  apply(): N;
}
export interface StringInputAction<N extends Node<{}>> {
  inputKind: InputKind.String;
  apply(input: string): N;
}
export interface OneOfInputAction<N extends Node<{}>, T> {
  inputKind: InputKind.OneOf;
  oneOf: T[];
  getLabel(value: T): string;
  apply(input: T): N;
}
export interface ChildInputAction<N extends Node<{}>> {
  inputKind: InputKind.Child;
  apply(selectedChildKey: string): N;
}
export interface ActionSet<N extends Node<any>> {
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
export function mergeActionSets<N extends Node<{}>>(
  bottom: ActionSet<N>,
  top: ActionSet<N>
): ActionSet<N> {
  return { ...bottom, ...top };
}
