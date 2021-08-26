import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import { offsetRectsMayIntersect } from "../../../divetree/divetree-core/lib";
import { unreachable } from "../logic/util";

type Path = number[];
type PathRange = { anchor: Path; offset: number };

enum NodeKind {
  Token,
  List,
}

type Node = TokenNode | ListNode;

interface TokenNode {
  kind: NodeKind.Token;
  content: string;
}

interface ListNode {
  kind: NodeKind.List;
  delimiters: [string, string];
  content: Node[];
}

interface Doc {
  root: ListNode;
}

const emptyToken: TokenNode = {
  kind: NodeKind.Token,
  content: "",
};

const emptyDoc: Doc = {
  root: { kind: NodeKind.List, delimiters: ["", ""], content: [] },
};

function docMapRoot(doc: Doc, cb: (node: ListNode) => Node): Doc {
  const newRoot = cb(doc.root);
  if (newRoot === doc.root) {
    return doc;
  }
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("newRoot must be a list");
  }
  return { ...doc, root: newRoot };
}

function nodeTryGetDeepestByPath(
  node: Node,
  path: Path,
): { path: Path; node: Node } {
  if (!path.length) {
    return { path: [], node };
  }
  switch (node.kind) {
    case NodeKind.Token:
      return { path: [], node };
    case NodeKind.List: {
      const childNode = node.content[path[0]];
      if (!childNode) {
        return { path: [], node };
      }
      const childResult = nodeTryGetDeepestByPath(childNode, path.slice(1));
      return { node: childResult.node, path: [path[0], ...childResult.path] };
    }
    default:
      return unreachable(node);
  }
}

function nodeGetByPath(node: Node, path: Path): Node | undefined {
  const result = nodeTryGetDeepestByPath(node, path);
  return result.path.length === path.length ? result.node : undefined;
}

function nodeSetByPath(node: Node, path: Path, value: Node): Node {
  if (!path.length) {
    return value;
  }
  switch (node.kind) {
    case NodeKind.Token:
      throw new Error("path too long");
    case NodeKind.List: {
      const targetIndex = path[0];
      const childNode = node.content[targetIndex];
      if (!childNode) {
        throw new Error("missing child");
      }
      const newContent = [...node.content];
      newContent[targetIndex] = nodeSetByPath(childNode, path.slice(1), value);
      if (newContent[targetIndex] === node.content[targetIndex]) {
        return node;
      }
      return { ...node, content: newContent };
    }
    default:
      return unreachable(node);
  }
}

function nodeMapAtPath(
  path: Path,
  cb: (node: Node) => Node,
): (node: Node) => Node {
  return (node) => {
    const oldFocusedNode = nodeGetByPath(node, path);
    if (!oldFocusedNode) {
      throw new Error("node at path does not exist");
    }
    return nodeSetByPath(node, path, cb(oldFocusedNode));
  };
}

enum Mode {
  Normal,
  Insert,
}

class DocManager {
  private doc: Doc = emptyDoc;
  private lastDoc: Doc = this.doc;
  private focus: PathRange = { anchor: [], offset: 0 };
  private history: { doc: Doc; focus: PathRange }[] = [
    { focus: this.focus, doc: this.doc },
  ];
  private mode = Mode.Normal;

  constructor(
    private _onUpdate: (stuff: {
      doc: Doc;
      focus: PathRange;
      mode: Mode;
    }) => void,
  ) {}

  onKeyPress = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter") {
        if (this.focus.offset !== 0) {
          return;
        }
        const focusedNode = nodeGetByPath(this.doc.root, this.focus.anchor);
        if (focusedNode?.kind !== NodeKind.List || focusedNode.content.length) {
          return;
        }
        this.doc = docMapRoot(this.doc, (root) =>
          nodeSetByPath(root, this.focus.anchor, {
            ...focusedNode,
            content: [emptyToken],
          }),
        );
        this.focus = { anchor: [...this.focus.anchor, 0], offset: 0 };
        this.mode = Mode.Insert;
      } else if (ev.key === "a") {
        // TODO flip so that anchor is on right
        if (!this.focus.anchor.length) {
          return;
        }
        const listPath = this.focus.anchor.slice(0, -1);
        const listNode = nodeGetByPath(this.doc.root, listPath);
        if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
          return;
        }
        this.mode = Mode.Insert;
      } else if (ev.key === "l") {
        this.tryMoveToSibling(1, false);
      } else if (ev.key === "L") {
        this.tryMoveToSibling(1, true);
      } else if (ev.key === "h") {
        this.tryMoveToSibling(-1, false);
      } else if (ev.key === "H") {
        this.tryMoveToSibling(-1, true);
      } else if (ev.key === "k") {
        this.tryMoveToParent();
      } else if (ev.key === "j") {
        this.tryMoveIntoList();
      }
    } else if (this.mode === Mode.Insert) {
      if (!this.focus.anchor.length) {
        throw new Error("root focused in insert mode");
      }
      const listPath = this.focus.anchor.slice(0, -1);
      this.doc = docMapRoot(
        this.doc,
        nodeMapAtPath(listPath, (oldListNode) => {
          if (oldListNode.kind !== NodeKind.List) {
            throw new Error("parent of focused node is not a list");
          }
          const newListNode = {
            ...oldListNode,
            content: [...oldListNode.content],
          };

          let lastNodeIndex =
            this.focus.anchor[this.focus.anchor.length - 1] + this.focus.offset;
          let lastNode = newListNode.content[lastNodeIndex];
          if (!lastNode) {
            throw new Error("lastNode does not exist");
          }

          const tokenPatterns = [
            { key: /^[a-zA-Z]$/, token: /^[a-zA-Z]*$/ },
            { key: /^\d$/, token: /^\d*$/ },
            { key: /^[+\-*/]$/, token: /^[+\-*/]*$/, singleChar: true },
          ];
          for (const {
            key: keyPattern,
            token: tokenPattern,
            singleChar = false,
          } of tokenPatterns) {
            if (ev.key.match(keyPattern)) {
              if (
                lastNode.kind !== NodeKind.Token ||
                !lastNode.content.match(tokenPattern) ||
                (lastNode.content.length === 1 && singleChar)
              ) {
                lastNodeIndex += 1;
                lastNode = emptyToken;
                newListNode.content.splice(lastNodeIndex, 0, lastNode);
                this.focus = { ...this.focus, offset: this.focus.offset + 1 };
              }
              lastNode = {
                ...lastNode,
                content: lastNode.content + ev.key,
              };
              newListNode.content[lastNodeIndex] = lastNode;
              return newListNode;
            }
          }

          const listDelimiters: [string, string][] = [["(", ")"]];
          for (const delimiters of listDelimiters) {
            if (ev.key === delimiters[0]) {
              lastNodeIndex += 1;
              lastNode = {
                kind: NodeKind.List,
                delimiters,
                content: [emptyToken],
              };
              newListNode.content.splice(lastNodeIndex, 0, lastNode);
              this.focus = {
                anchor: [...listPath, lastNodeIndex, 0],
                offset: 0,
              };
              return newListNode;
            } else if (ev.key === delimiters[1]) {
              if (oldListNode.delimiters[1] === delimiters[1]) {
                this.focus = {
                  anchor: listPath,
                  offset: 0,
                };
                return oldListNode;
              }
            }
          }

          return oldListNode;
        }),
      );
    }

    this.onUpdate();
  };

  onKeyDown = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Insert && ev.key === "Escape") {
      this.mode = Mode.Normal;
      this.history = [];
      const listPath = this.focus.anchor.slice(0, -1);
      const oldListNode = nodeGetByPath(this.doc.root, listPath);
      if (oldListNode?.kind !== NodeKind.List) {
        throw new Error("expected list to be parent of focused node");
      }
      if (
        oldListNode.content.every(
          (c) => c.kind === NodeKind.Token && !c.content.trim(),
        )
      ) {
        const newListNode = { ...oldListNode, content: [] };
        this.doc = docMapRoot(this.doc, (root) =>
          nodeSetByPath(root, listPath, newListNode),
        );
        this.focus = { anchor: listPath, offset: 0 };
      }
      this.onUpdate();
    } else if (this.mode === Mode.Insert && ev.key === "Backspace") {
      if (this.history.length < 2) {
        return;
      }
      this.history.pop();
      const old = this.history.pop()!;
      this.doc = old.doc;
      this.focus = old.focus;
      this.onUpdate();
    }
  };

  private tryMoveToSibling(offset: number, extend: boolean) {
    const newAnchor = [...this.focus.anchor];
    newAnchor[newAnchor.length - 1] += this.focus.offset + offset;
    if (!nodeGetByPath(this.doc.root, newAnchor)) {
      return;
    }
    this.focus = extend
      ? { anchor: this.focus.anchor, offset: this.focus.offset + offset }
      : { anchor: newAnchor, offset: 0 };
  }

  private tryMoveToParent() {
    if (this.focus.anchor.length < 2) {
      return;
    }
    this.focus = { anchor: this.focus.anchor.slice(0, -1), offset: 0 };
  }

  private tryMoveIntoList() {
    if (this.focus.offset !== 0) {
      return;
    }
    const listPath = this.focus.anchor;
    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
      return;
    }
    this.focus = {
      anchor: [...listPath, 0],
      offset: listNode.content.length - 1,
    };
  }

  private onUpdate() {
    if (this.doc !== this.lastDoc) {
      this.lastDoc = this.doc;
    }
    this.fixFocus();
    this.history.push({ doc: this.doc, focus: this.focus });
    this._onUpdate({ doc: this.doc, focus: this.focus, mode: this.mode });
  }

  private fixFocus() {
    const newAnchor = nodeTryGetDeepestByPath(
      this.doc.root,
      this.focus.anchor,
    ).path;
    if (newAnchor.length !== this.focus.anchor.length) {
      this.focus = { anchor: newAnchor, offset: 0 };
      return;
    }
    if (this.focus.anchor.length === 0 && this.focus.offset) {
      console.warn("offset must be zero for root node");
      this.focus = { ...this.focus, offset: 0 };
      return;
    }
    let newOffset = 0;
    for (let i = 1; i <= Math.abs(this.focus.offset); i++) {
      const offsetPath = [...this.focus.anchor];
      offsetPath[offsetPath.length - 1] += i * Math.sign(this.focus.offset);
      if (!nodeGetByPath(this.doc.root, offsetPath)) {
        break;
      }
      newOffset = i * Math.sign(this.focus.offset);
    }
    this.focus = { ...this.focus, offset: newOffset };
  }
}

const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
`;

const styles = {
  doc: css`
    margin: 5px;
  `,
  modeLine: css`
    margin: 5px;
    margin-top: 15px;
  `,
  token: css`
    position: relative;
    display: inline-block;
    &:not(:last-child) {
      padding-right: 5px;
    }
  `,
  list: css`
    display: inline-block;
    &:not(:last-child) {
      padding-right: 5px;
    }
  `,
  listInner: css`
    display: inline-block;
  `,
  listDelimiter: css`
    display: inline-block;
  `,
  cursor: css`
    position: absolute;
    display: block;
    background: black;
    width: ${2 / window.devicePixelRatio}px;
    top: -2px;
    bottom: -2px;
    right: -1.5px;
    animation: ${pulse} 1s ease infinite;
    ::before {
      content: ".";
      visibility: hidden;
    }
  `,
};

function renderNode({
  node,
  key,
  focus,
  isTipOfFocus,
  showCursor,
}: {
  node: Node;
  key: React.Key;
  focus: PathRange | undefined;
  isTipOfFocus: boolean;
  showCursor: boolean;
}): React.ReactChild {
  const focused = focus !== undefined && focus.anchor.length === 0;
  let focusedChildRange: [number, number] | undefined;
  let tipOfFocusIndex: number | undefined;
  if (focus?.anchor.length) {
    const offset = focus.anchor.length === 1 ? focus.offset : 0;
    focusedChildRange = [focus.anchor[0], focus.anchor[0] + offset];
    tipOfFocusIndex = focusedChildRange[1];
    if (focusedChildRange[0] > focusedChildRange[1]) {
      focusedChildRange = [focusedChildRange[1], focusedChildRange[0]];
    }
  }

  const tokenBackground = focused
    ? isTipOfFocus
      ? "rgba(11, 83, 255, 0.37)"
      : "rgba(11, 83, 255, 0.15)"
    : undefined;

  switch (node.kind) {
    case NodeKind.Token:
      return (
        <div
          key={key}
          className={styles.token}
          style={{ background: tokenBackground }}
        >
          {node.content || "\u200b"}
          {isTipOfFocus && showCursor && <div className={styles.cursor} />}
        </div>
      );
    case NodeKind.List:
      return (
        <div
          key={key}
          className={styles.list}
          style={{ background: tokenBackground }}
        >
          <div className={styles.listDelimiter}>{node.delimiters[0]}</div>
          <div className={styles.listInner}>
            {node.content.map((c, i) =>
              renderNode({
                node: c,
                key: i,
                focus:
                  focusedChildRange &&
                  i >= focusedChildRange[0] &&
                  i <= focusedChildRange[1]
                    ? { anchor: focus!.anchor.slice(1), offset: focus!.offset }
                    : undefined,
                isTipOfFocus: i === tipOfFocusIndex,
                showCursor,
              }),
            )}
          </div>
          <div className={styles.listDelimiter}>{node.delimiters[1]}</div>
        </div>
      );
  }
}

export const LinearEditor = () => {
  const [{ doc, focus, mode }, setStuff] = useState<{
    doc: Doc;
    focus: PathRange;
    mode: Mode;
  }>({
    doc: emptyDoc,
    focus: { anchor: [], offset: 0 },
    mode: Mode.Normal,
  });
  const [docManager, setDocManager] = useState(new DocManager(setStuff));
  useEffect(() => {
    setDocManager((oldDocManager) => {
      const newDocManager = new DocManager(setStuff);
      (newDocManager as any).doc = (oldDocManager as any).doc;
      (newDocManager as any).history = (oldDocManager as any).history;
      return newDocManager;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DocManager]);

  useEffect(() => {
    document.addEventListener("keypress", docManager.onKeyPress);
    document.addEventListener("keydown", docManager.onKeyDown);
    return () => {
      document.removeEventListener("keypress", docManager.onKeyPress);
      document.removeEventListener("keydown", docManager.onKeyDown);
    };
  }, [docManager]);

  return (
    <div>
      <div className={styles.doc}>
        {renderNode({
          node: doc.root,
          key: "root",
          focus,
          isTipOfFocus: false,
          showCursor: mode === Mode.Insert,
        })}
      </div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      <pre>{JSON.stringify({ doc, focus }, null, 2)}</pre>
    </div>
  );
};
