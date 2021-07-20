import { Path } from "./base";
import { ActionSet } from "./action";
import { v4 as genUuid } from "uuid";
import { MetaSplit } from "../transform/transforms/split-meta";
import { ParentPathElement } from "../parent-index";
import type { RootNode as DivetreeDisplayRootNode } from "divetree-core";
import { PostLayoutHints } from "../layout-hints";

export interface BuildDivetreeDisplayTreeArgs {
  nodeForDisplay: Node<unknown>;
  focusPath: string[];
  expand: boolean;
  showChildNavigationHints: boolean;
  parentPath: ParentPathElement[];
  buildChildDisplayTree: (childNode: Node<unknown>) => DivetreeDisplayRootNode;
  updatePostLayoutHints: (
    nodeId: string,
    updateHints: (oldHints: PostLayoutHints) => PostLayoutHints,
  ) => void;
}

export interface Node<B> {
  unapplyTransform?(): BuildResult<Node<B>>;
}

export abstract class Node<B> {
  id: string = genUuid();
  abstract children: ChildNodeEntry<any>[];
  metaSplit: MetaSplit | undefined;
  abstract flags: FlagSet;
  abstract actions: ActionSet<Node<B>>;
  abstract clone(): Node<B>;
  abstract setChild(child: ChildNodeEntry<any>): Node<B>;
  abstract setFlags(flags: this["flags"]): Node<B>;
  setDeepChild(path: Path, node: Node<any>): Node<B> {
    if (path.length === 1) {
      return this.setChild({ key: path[0], node });
    } else if (path.length) {
      const directChild = this.getByPath(path.slice(0, 1));
      if (!directChild) {
        throw new Error(`Missing (possibly indirect) child ${path[0]}`);
      }
      return this.setChild({
        key: path[0],
        node: directChild.setDeepChild(path.slice(1), node),
      });
    }
    return node;
  }
  getByPath(path: Path): Node<any> | undefined {
    if (path.length) {
      const childNode = this.children.find((e) => e.key === path[0]);
      return childNode ? childNode.node.getByPath(path.slice(1)) : undefined;
    }
    return this;
  }
  getDeepestPossibleByPath(
    path: Path,
    traversed: Path = [],
  ): {
    path: Path;
    node: Node<any>;
  } {
    if (path.length) {
      const childNode = this.children.find((e) => e.key === path[0]);
      return childNode
        ? childNode.node.getDeepestPossibleByPath(path.slice(1), [
            ...traversed,
            path[0],
          ])
        : { path: traversed, node: this };
    }
    return { path: traversed, node: this };
  }
  getDisplayInfo(parentPath: ParentPathElement[]): DisplayInfo | undefined {
    return undefined;
  }
  getDebugLabel(): string | undefined {
    return undefined;
  }
  getChildShortcuts(): Map<string, string[]> {
    const shortcuts = new Map<string, string[]>();
    for (const { key: childKey } of this.children) {
      const shortcut = childKey[0];
      if (!childKey.length || shortcuts.has(shortcut)) {
        continue;
      }
      shortcuts.set(shortcut, [childKey]);
    }
    return shortcuts;
  }
  buildDivetreeDisplayTree(
    args: BuildDivetreeDisplayTreeArgs,
  ): DivetreeDisplayRootNode | undefined {
    return undefined;
  }
  protected buildHelper(
    cb: (builtChildren: { [key: string]: any }) => B,
  ): BuildResult<B> {
    const builtChildren: {
      [key: string]: any;
    } = {};
    for (const e of this.children) {
      const result = e.node.build();
      if (!result.ok) {
        return {
          ok: false,
          error: { ...result.error, path: [e.key, ...result.error.path] },
        };
      }
      builtChildren[e.key] = result.value;
    }
    try {
      return { ok: true, value: cb(builtChildren) };
    } catch (e) {
      return { ok: false, error: { message: e.message, path: [] } };
    }
  }
  abstract build(): BuildResult<B>;
}
export interface ChildNodeEntry<B> {
  key: string;
  node: Node<B>;
}
export type FlagSet = {
  [key: string]: Flag;
};
export type Flag = boolean | OneOfFlag;
export interface OneOfFlag {
  value: string;
  oneOf: string[];
}
export type BuildResult<B> = BuildResultSuccess<B> | BuildResultFailure;
export interface BuildResultSuccess<B> {
  ok: true;
  value: B;
}
export interface BuildResultFailure {
  ok: false;
  error: TargetedError;
}
export interface TargetedError {
  path: Path;
  message: string;
}
/*
export interface TargetedDisplayInfo {
  path: Path;
  info: DisplayInfo;
}
*/
export interface DisplayInfo {
  priority: DisplayInfoPriority;
  label: LabelPart[];
  color?: SemanticColor;
}
/*
export interface PrioritizedLabel {
  priority: LabelPriority;
  parts: LabelPart[];
}
*/
export interface LabelPart {
  text: string;
  style: LabelStyle;
}
export enum DisplayInfoPriority {
  LOW,
  MEDIUM,
  HIGH,
}
export enum LabelStyle {
  UNKNOWN,
  WHITESPACE,
  SYNTAX_SYMBOL,
  NAME,
  TYPE_SUMMARY,
  REFERENCED_NAME,
  KEYWORD,
  SECTION_NAME,
  VALUE,
}
export enum SemanticColor {
  LITERAL = "LITERAL",
  DECLARATION = "DECLARATION",
  DECLARATION_NAME = "DECLARATION_NAME",
  REFERENCE = "REFERENCE",
}
