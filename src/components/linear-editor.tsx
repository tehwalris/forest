import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import { unreachable } from "../logic/util";

type Path = number[];

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

function docGetLastToken(doc: Doc, focus: Path): TokenNode | undefined {
  const focusedNode = nodeGetByPath(doc.root, focus);
  if (!focusedNode) {
    throw new Error("expected focusedNode");
  }
  return nodeGetLastToken(focusedNode);
}

function docSetLastToken(doc: Doc, newToken: TokenNode, focus: Path): Doc {
  return docMapRoot(
    doc,
    nodeMapAtPath(focus, (node) => nodeSetLastToken(node, newToken)),
  );
}

function docAppendNode(doc: Doc, node: Node, focus: Path): Doc {
  return docMapRoot(
    doc,
    nodeMapAtPath(focus, (oldFocusedNode) => {
      if (oldFocusedNode.kind !== NodeKind.List) {
        throw new Error("focused node does not exist or is not a list");
      }
      return {
        ...oldFocusedNode,
        content: [...oldFocusedNode.content, node],
      };
    }),
  );
}

function nodeGetLastToken(node: Node): TokenNode | undefined {
  switch (node.kind) {
    case NodeKind.Token:
      return node;
    case NodeKind.List:
      return node.content.reduceRight(
        (a: TokenNode | undefined, c) => a || nodeGetLastToken(c),
        undefined,
      );
    default:
      return unreachable(node);
  }
}

function nodeSetLastToken(node: Node, newToken: TokenNode): Node {
  switch (node.kind) {
    case NodeKind.Token:
      return newToken;
    case NodeKind.List:
      const targetIndex = node.content.reduceRight(
        (a: number | undefined, c, i) =>
          a === undefined && nodeGetLastToken(c) ? i : a,
        undefined,
      );
      if (targetIndex === undefined) {
        return node;
      }
      const newContent = [...node.content];
      newContent[targetIndex] = nodeSetLastToken(
        newContent[targetIndex],
        newToken,
      );
      if (newContent[targetIndex] === node.content[targetIndex]) {
        return node;
      }
      return { ...node, content: newContent };
    default:
      return unreachable(node);
  }
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

class DocManager {
  private doc: Doc = emptyDoc;
  private lastDoc: Doc = this.doc;
  private focus: Path = [];
  private history: { doc: Doc; focus: Path }[] = [
    { focus: this.focus, doc: this.doc },
  ];

  constructor(private _onUpdate: (stuff: { doc: Doc; focus: Path }) => void) {}

  onKeyPress = (ev: KeyboardEvent) => {
    if (!docGetLastToken(this.doc, this.focus)) {
      this.doc = docAppendNode(this.doc, emptyToken, this.focus);
    }
    let lastToken = docGetLastToken(this.doc, this.focus)!;

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
          !lastToken.content.match(tokenPattern) ||
          (lastToken.content.length === 1 && singleChar)
        ) {
          this.doc = docAppendNode(this.doc, emptyToken, this.focus);
          lastToken = docGetLastToken(this.doc, this.focus)!;
        }
        this.doc = docSetLastToken(
          this.doc,
          {
            ...lastToken,
            content: lastToken.content + ev.key,
          },
          this.focus,
        );
        break;
      }
    }

    const listDelimiters: [string, string][] = [["(", ")"]];
    for (const delimiters of listDelimiters) {
      if (ev.key === delimiters[0]) {
        this.doc = docAppendNode(
          this.doc,
          {
            kind: NodeKind.List,
            delimiters,
            content: [],
          },
          this.focus,
        );
        const focusedNode = nodeGetByPath(this.doc.root, this.focus);
        if (focusedNode?.kind !== NodeKind.List) {
          throw new Error("focusedNode does not exist or is not a list");
        }
        this.focus = [...this.focus, focusedNode.content.length - 1];
        break;
      } else if (ev.key === delimiters[1]) {
        const focusedNode = nodeGetByPath(this.doc.root, this.focus);
        if (
          focusedNode?.kind === NodeKind.List &&
          focusedNode.delimiters[1] === delimiters[1]
        ) {
          this.focus = this.focus.slice(0, -1);
          break;
        }
      }
    }

    this.onUpdate();
  };

  onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Backspace") {
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

  private onUpdate() {
    if (this.doc !== this.lastDoc) {
      this.lastDoc = this.doc;
    }
    this.focus = nodeTryGetDeepestByPath(this.doc.root, this.focus).path;
    this.history.push({ doc: this.doc, focus: this.focus });
    this._onUpdate({ doc: this.doc, focus: this.focus });
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
  token: css`
    display: inline-block;
    &:not(:last-child) {
      margin-right: 5px;
    }
  `,
  list: css`
    display: inline-block;
    &:not(:last-child) {
      margin-right: 5px;
    }
  `,
  listInner: css`
    display: inline-block;
    position: relative;
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

function renderNode(
  node: Node,
  key: React.Key,
  focus: Path | undefined,
): React.ReactChild {
  const focused = focus !== undefined && focus.length === 0;
  switch (node.kind) {
    case NodeKind.Token:
      return (
        <div key={key} className={styles.token}>
          {node.content}
        </div>
      );
    case NodeKind.List:
      return (
        <div key={key} className={styles.list}>
          <div
            className={styles.listDelimiter}
            style={{ background: focused ? "wheat" : undefined }}
          >
            {node.delimiters[0]}
          </div>
          <div
            className={styles.listInner}
            style={{ background: focused ? "#0b53ff26" : undefined }}
          >
            {!node.content.length && "\u200b"}
            {focused && <div className={styles.cursor} />}
            {node.content.map((c, i) =>
              renderNode(c, i, focus?.[0] === i ? focus.slice(1) : undefined),
            )}
          </div>
          <div
            className={styles.listDelimiter}
            style={{ background: focused ? "wheat" : undefined }}
          >
            {node.delimiters[1]}
          </div>
        </div>
      );
  }
}

export const LinearEditor = () => {
  const [{ doc, focus }, setStuff] = useState<{ doc: Doc; focus: Path }>({
    doc: emptyDoc,
    focus: [],
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
    <div className={styles.doc}>{renderNode(doc.root, "root", focus)}</div>
  );
};
