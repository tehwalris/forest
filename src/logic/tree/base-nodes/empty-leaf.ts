import { ActionSet } from "../action";
import { Node, BuildResult } from "../node";
export class EmptyLeafNode extends Node<undefined> {
  children: never[] = [];
  flags = {};
  actions: ActionSet<never> = {};
  constructor(private debugLabel?: string) {
    super();
  }
  clone(): EmptyLeafNode {
    return new EmptyLeafNode();
  }
  setChild(child: never): never {
    throw new Error("EmptyLeafNode can't have children");
  }
  setFlags(flags: never): never {
    throw new Error("Flags not supported");
  }
  build(): BuildResult<undefined> {
    return { ok: true, value: undefined };
  }
  getDebugLabel() {
    return this.debugLabel;
  }
}
