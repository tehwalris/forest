var inner: any;
var InputKind: any;

export function example() {
  this.actions.setVariant = inner.actions.setVariant;
  this.actions.replace = {
    inputKind: InputKind.Node,
    apply: (...args) => {
      const newNode = inner.actions.replace?.apply(...args);
      return newNode === inner ? this : newNode;
    },
  };
}
