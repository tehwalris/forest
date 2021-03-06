import { ActionSet } from "../action";
import { Node, ChildNodeEntry, BuildResult } from "../node";
export abstract class StructNode<T, B> extends Node<B> {
  actions: ActionSet<StructNode<T, B>> = {};
  abstract children: ChildNodeEntry<any>[];
  setChild(newChild: ChildNodeEntry<any>): StructNode<T, B> {
    let didReplace = false;
    const newChildren = this.children.map(e => {
      if (e.key === newChild.key) {
        didReplace = true;
        return newChild;
      }
      return e;
    });
    if (!didReplace) {
      newChildren.push(newChild);
    }
    return this.setChildren(newChildren);
  }
  protected buildChildren(): BuildResult<{ [key: string]: T }> {
    const builtValues: { [key: string]: T } = {};
    for (const child of this.children) {
      const buildResult = child.node.build();
      if (!buildResult.ok) {
        return {
          ok: false,
          error: {
            message: buildResult.error.message,
            path: [child.key, ...buildResult.error.path],
          },
        };
      }
      builtValues[child.key] = buildResult.value;
    }
    return { ok: true, value: builtValues };
  }
  protected abstract setChildren(
    value: ChildNodeEntry<any>[],
  ): StructNode<T, B>;
  protected abstract createChild(): Node<T>;
  abstract build(): BuildResult<B>;
}
