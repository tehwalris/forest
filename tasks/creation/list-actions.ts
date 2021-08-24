// src/logic/tree/base-nodes/list.ts

var InputKind: any;

export function getActions() {
  return {
    insertChildAtIndex: {
      inputKind: InputKind.ChildIndex,
      apply: (targetIndex) => {
        const newChildren = [...this.children.map((e) => e.node)];
        newChildren.splice(targetIndex, 0, this.createChild());
        return this.setValue(newChildren);
      },
    },
    prepend: {
      inputKind: InputKind.None,
      apply: () =>
        this.setValue([
          this.createChild(),
          ...this.children.map((e) => e.node),
        ]),
    },
    append: {
      inputKind: InputKind.None,
      apply: () =>
        this.setValue([
          ...this.children.map((e) => e.node),
          this.createChild(),
        ]),
    },
    deleteChild: {
      inputKind: InputKind.Child,
      apply: (k) =>
        this.setValue(
          this.children.filter((e) => e.key !== k).map((e) => e.node),
        ),
    },
  };
}
