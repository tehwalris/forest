import { Node } from "./node";
export enum InputKind {
  None,
  String,
  OneOf,
  Child,
  Node,
  ChildIndex,
}
export type Action<N extends Node<unknown>> =
  | NoInputAction<N>
  | StringInputAction<N>
  | OneOfInputAction<N, any>
  | ChildInputAction<N>
  | NodeInputAction<any, any>
  | ChildIndexInputAction<N>;
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
export interface NodeInputAction<B, I extends Node<unknown>> {
  inputKind: InputKind.Node;
  apply(inputNode: I): Node<B>;
}
export interface ActionSet<N extends Node<unknown>> {
  insertChildAtIndex?: ChildIndexInputAction<N>;
  prepend?: NoInputAction<N>;
  append?: NoInputAction<N>;
  setFromString?: StringInputAction<N>;
  setVariant?: OneOfInputAction<N, unknown>;
  deleteChild?: ChildInputAction<N>;
  replace?: NodeInputAction<unknown, Node<unknown>>;
  [key: string]: Action<N> | undefined;
}
export function mergeActionSets<N extends Node<unknown>>(
  bottom: ActionSet<N>,
  top: ActionSet<N>,
): ActionSet<N> {
  return { ...bottom, ...top };
}
interface ChildIndexInputAction<N extends Node<unknown>> {
  inputKind: InputKind.ChildIndex;
  apply(childIndex: number): N;
}
