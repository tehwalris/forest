var InputKind: any;

class Node<T> {
  actions: any;
}

export class RequiredHoleNode<T> extends Node<T> {
  constructor(private inner: Node<T>) {
    super();
    if (!RequiredHoleNode.isValidInnerNode(inner)) {
      throw new Error("invalid inner node");
    }
    this.actions.setVariant = inner.actions.setVariant;
    this.actions.setFromLiveString = inner.actions.setFromLiveString;
    this.actions.replace = {
      inputKind: InputKind.Node,
      apply: (...args) => {
        const newNode = inner.actions.replace?.apply(...args);
        return newNode === undefined || newNode === inner ? this : newNode;
      },
    };
  }

  private static isValidInnerNode(node: Node<unknown>): boolean {
    return true;
  }
}
