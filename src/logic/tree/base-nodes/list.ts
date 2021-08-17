import { NodeKind } from "divetree-core";
import { arrayFromTextSize } from "../../text-measurement";
import { ActionSet, InputKind } from "../action";
import { leafDoc } from "../display-line";
import {
  Node,
  ChildNodeEntry,
  BuildResult,
  DisplayInfoPriority,
  LabelStyle,
  LabelPart,
} from "../node";
import { EmptyLeafNode } from "./empty-leaf";
export abstract class ListNode<T, B> extends Node<B> {
  children: ChildNodeEntry<T>[];
  actions: ActionSet<ListNode<T, B>>;
  constructor(
    protected value: Node<T>[],
    protected placeholderNode: EmptyLeafNode,
  ) {
    super();
    if (value.length) {
      this.children = value.map((e, i) => ({ key: `${i}`, node: e }));
    } else {
      this.children = [
        { key: "0", node: placeholderNode as Node<any> as Node<T> },
      ];
    }
    this.actions = {
      insertChildAtIndex: {
        inputKind: InputKind.ChildIndex,
        apply: (targetIndex) => {
          const newChildren = [
            ...this.children.slice(0, this.value.length).map((e) => e.node),
          ];
          newChildren.splice(targetIndex, 0, this.createChild());
          return this.setValue(newChildren);
        },
      },
      append: {
        inputKind: InputKind.None,
        apply: () =>
          this.setValue([
            ...this.children.slice(0, this.value.length).map((e) => e.node),
            this.createChild(),
          ]),
      },
      deleteChild: {
        inputKind: InputKind.Child,
        apply: (k) =>
          this.setValue(
            this.children
              .slice(0, this.value.length)
              .filter((e) => e.key !== k)
              .map((e) => e.node),
          ),
      },
    };
  }
  setChild(newChild: ChildNodeEntry<T>): ListNode<T, B> {
    const newValue = [...this.value];
    newValue[+newChild.key] = newChild.node;
    return this.setValue(newValue);
  }
  listBuildHelper(cb: (children: T[]) => B): BuildResult<B> {
    return this.buildHelper((children) => {
      if (this.value.length) {
        return cb(Object.keys(children).map((e, i) => children[`${i}`]));
      } else {
        return cb([]);
      }
    });
  }
  getChildShortcuts() {
    const shortcuts = new Map<string, string[]>();
    for (const [i, { key }] of this.children.slice(0, 9).entries()) {
      shortcuts.set(`${i + 1}`, [key]);
    }
    return shortcuts;
  }
  static makePlaceholder(): EmptyLeafNode {
    const label: LabelPart[] = [
      { text: "no items", style: LabelStyle.LIST_PLACEHOLDER },
    ];
    const node = new EmptyLeafNode("no items", {
      priority: DisplayInfoPriority.MEDIUM,
      label,
    });
    node.buildDoc = ({
      nodeForDisplay,
      updatePostLayoutHints,
      measureLabel,
    }) => {
      updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
        ...oldHints,
        styleAsText: true,
        label,
      }));
      return leafDoc({
        kind: NodeKind.TightLeaf,
        id: nodeForDisplay.id,
        size: arrayFromTextSize(measureLabel(label)),
      });
    };
    return node;
  }
  protected abstract setValue(value: Node<T>[]): ListNode<T, B>;
  protected abstract createChild(): Node<T>;
  abstract build(): BuildResult<B>;
}
