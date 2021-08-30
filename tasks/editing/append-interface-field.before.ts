type Node<N> = any;
type Action<N> = any;

export interface Props<N extends Node<unknown>> {
  action: Action<N>;
  onCancel: () => void;
  onApply: (node: N) => void;
}
