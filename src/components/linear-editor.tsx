import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import { unreachable } from "../logic/util";

type Path = number[];
type PathRange = { anchor: Path; offset: number };

enum SyntaxKind {
  RawText,
  Identifier,
  NumericLiteral,
  BinaryOperator,
}

enum NodeKind {
  Token,
  List,
}

type Node = TokenNode | ListNode;

interface TokenNode {
  kind: NodeKind.Token;
  syntaxKind: SyntaxKind;
  content: string;
}

interface ListNode {
  kind: NodeKind.List;
  delimiters: [string, string];
  separator: string;
  content: Node[];
}

interface Doc {
  root: ListNode;
}

const emptyToken: TokenNode = {
  kind: NodeKind.Token,
  syntaxKind: SyntaxKind.RawText,
  content: "",
};

const emptyDoc: Doc = {
  root: {
    kind: NodeKind.List,
    delimiters: ["", ""],
    separator: " ",
    content: [],
  },
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

function flipPathRange(oldPathRange: PathRange): PathRange {
  if (!oldPathRange.anchor.length || !oldPathRange.offset) {
    return oldPathRange;
  }
  const newPathRange = {
    anchor: [...oldPathRange.anchor],
    offset: -oldPathRange.offset,
  };
  newPathRange.anchor[newPathRange.anchor.length - 1] += oldPathRange.offset;
  return newPathRange;
}

function getPathToTip(pathRange: PathRange): Path {
  const path = [...pathRange.anchor];
  if (!path.length) {
    return [];
  }
  path[path.length - 1] += pathRange.offset;
  return path;
}

function reparseNodes(oldNodes: Node[]): Node[] {
  if (!oldNodes.length) {
    return oldNodes;
  }

  const identifiers: Node[] = [];
  let expectDot = false;
  for (const node of oldNodes) {
    if (expectDot) {
      if (
        node.kind !== NodeKind.Token ||
        node.syntaxKind !== SyntaxKind.RawText ||
        node.content !== "."
      ) {
        return oldNodes;
      }
      expectDot = false;
    } else {
      if (
        node.kind === NodeKind.Token &&
        node.syntaxKind === SyntaxKind.RawText
      ) {
        return oldNodes;
      }
      identifiers.push(node);
      expectDot = true;
    }
  }

  if (!expectDot || identifiers.length <= 1) {
    return oldNodes;
  }

  return [
    {
      kind: NodeKind.List,
      delimiters: ["", ""],
      separator: ".",
      content: identifiers,
    },
  ];
}

function withoutEmptyTokens(
  doc: Doc,
  focus: PathRange,
): { doc: Doc; focus: PathRange } {
  if (focus.offset < 0) {
    const result = withoutEmptyTokens(doc, flipPathRange(focus));
    return { doc: result.doc, focus: flipPathRange(result.focus) };
  }
  const result = _withoutEmptyTokens(doc.root, focus)!;
  return {
    doc: docMapRoot(doc, () => result.node),
    focus: result.focus || { anchor: [], offset: 0 },
  };
}

function _withoutEmptyTokens(
  node: Node,
  focus: PathRange | undefined,
): { node: Node; focus: PathRange | undefined } | undefined {
  if (node.kind === NodeKind.Token && node.content) {
    return { node, focus };
  }
  if (node.kind === NodeKind.Token && !node.content) {
    return undefined;
  } else if (node.kind === NodeKind.List) {
    if (!node.content.length) {
      return { node, focus };
    }

    let focusedChildIndex: number | undefined;
    let directlyFocusedChildRange: [number, number] | undefined;
    if (focus?.anchor.length === 1) {
      directlyFocusedChildRange = [
        focus.anchor[0],
        focus.anchor[0] + focus.offset,
      ];
      if (directlyFocusedChildRange[0] > directlyFocusedChildRange[1]) {
        directlyFocusedChildRange = [
          directlyFocusedChildRange[1],
          directlyFocusedChildRange[0],
        ];
      }
    } else if (focus && focus.anchor.length > 1) {
      focusedChildIndex = focus.anchor[0];
    }

    const results = node.content.map((c, i) =>
      _withoutEmptyTokens(
        c,
        focusedChildIndex === i
          ? { anchor: focus!.anchor.slice(1), offset: focus!.offset }
          : directlyFocusedChildRange &&
            i >= directlyFocusedChildRange[0] &&
            i <= directlyFocusedChildRange[1]
          ? { anchor: [], offset: 0 }
          : undefined,
      ),
    );

    const newNode = {
      ...node,
      content: results
        .map((r) => r?.node)
        .filter((v) => v)
        .map((v) => v!),
    };

    if (!focus) {
      return { node: newNode, focus: undefined };
    }
    if (!newNode.content.length) {
      return { node: newNode, focus: { anchor: [], offset: 0 } };
    }
    if (directlyFocusedChildRange && results.some((r) => r?.focus)) {
      const remainingResults = results.filter((r) => r);
      const firstIndex = remainingResults.findIndex((r) => r?.focus);
      let lastIndex = firstIndex;
      for (let i = firstIndex; i < remainingResults.length; i++) {
        if (remainingResults[i]?.focus) {
          lastIndex = i;
        }
      }
      return {
        node: newNode,
        focus: { anchor: [firstIndex], offset: lastIndex - firstIndex },
      };
    }
    if (focusedChildIndex !== undefined) {
      const childFocus = results[focusedChildIndex]?.focus;
      if (childFocus) {
        const newFocusedChildIndex = results
          .map((r, i) => [r, i])
          .filter(([r, i]) => r)
          .map(([r, i]) => i)
          .indexOf(focusedChildIndex);
        return {
          node: newNode,
          focus: {
            anchor: [newFocusedChildIndex, ...childFocus.anchor],
            offset: childFocus.offset,
          },
        };
      } else {
        return { node: newNode, focus: { anchor: [], offset: 0 } };
      }
    }
    if (!directlyFocusedChildRange) {
      return { node: newNode, focus: focus };
    }
    return { node: newNode, focus: { anchor: [], offset: 0 } };
  }
}

enum Mode {
  Normal,
  InsertBefore,
  InsertAfter,
}

class DocManager {
  private doc: Doc = emptyDoc;
  private lastDoc: Doc = this.doc;
  private focus: PathRange = { anchor: [], offset: 0 };
  private parentFocuses: PathRange[] = [];
  private history: {
    doc: Doc;
    focus: PathRange;
    parentFocuses: PathRange[];
  }[] = [
    { focus: this.focus, doc: this.doc, parentFocuses: this.parentFocuses },
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
      if (ev.key === "Enter" && ev.ctrlKey) {
        if (this.focus.anchor.length === 0) {
          return;
        }
        const forwardFocus =
          this.focus.offset < 0 ? flipPathRange(this.focus) : this.focus;
        const focusedNodes: Node[] = [];
        for (let i = 0; i <= forwardFocus.offset; i++) {
          const path = [...forwardFocus.anchor];
          path[path.length - 1] += i;
          const node = nodeGetByPath(this.doc.root, path);
          if (!node) {
            throw new Error("one of the focused nodes does not exist");
          }
          focusedNodes.push(node);
        }
        const reparsedNodes = reparseNodes(focusedNodes);
        if (reparsedNodes === focusedNodes) {
          return;
        }
        if (!reparseNodes.length) {
          throw new Error("reparse gave 0 nodes");
        }
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(forwardFocus.anchor.slice(0, -1), (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const newContent = [...oldListNode.content];
            newContent.splice(
              forwardFocus.anchor[forwardFocus.anchor.length - 1],
              forwardFocus.offset + 1,
              ...reparsedNodes,
            );
            return { ...oldListNode, content: newContent };
          }),
        );
        this.focus = { ...forwardFocus, offset: reparsedNodes.length - 1 };
      } else if (ev.key === "Enter" && !ev.ctrlKey) {
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
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "i") {
        if (!this.focus.anchor.length) {
          return;
        }
        const listPath = this.focus.anchor.slice(0, -1);
        const listNode = nodeGetByPath(this.doc.root, listPath);
        if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
          return;
        }
        if (this.focus.offset < 0) {
          this.focus = flipPathRange(this.focus);
        }
        const newTokenIndex = this.focus.anchor[this.focus.anchor.length - 1];
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(listPath, (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const newContent = [...oldListNode.content];
            newContent.splice(newTokenIndex, 0, emptyToken);
            return {
              ...oldListNode,
              content: newContent,
            };
          }),
        );
        this.focus = {
          anchor: [...this.focus.anchor.slice(0, -1), newTokenIndex + 1],
          offset: this.focus.offset,
        };
        this.focus = flipPathRange(this.focus);
        this.mode = Mode.InsertBefore;
      } else if (ev.key === "a") {
        if (!this.focus.anchor.length) {
          return;
        }
        const listPath = this.focus.anchor.slice(0, -1);
        const listNode = nodeGetByPath(this.doc.root, listPath);
        if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
          return;
        }
        if (this.focus.offset > 0) {
          this.focus = flipPathRange(this.focus);
        }
        const newTokenIndex =
          this.focus.anchor[this.focus.anchor.length - 1] + 1;
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(listPath, (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const newContent = [...oldListNode.content];
            newContent.splice(newTokenIndex, 0, emptyToken);
            return {
              ...oldListNode,
              content: newContent,
            };
          }),
        );
        this.focus = {
          anchor: [...this.focus.anchor.slice(0, -1), newTokenIndex],
          offset: this.focus.offset - 1,
        };
        this.focus = flipPathRange(this.focus);
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "d") {
        let forwardFocus =
          this.focus.offset < 0 ? flipPathRange(this.focus) : this.focus;
        if (this.focus.anchor.length === 0) {
          if (!this.doc.root.content.length) {
            return;
          }
          forwardFocus = {
            anchor: [0],
            offset: this.doc.root.content.length - 1,
          };
        }
        let newFocusIndex: number | undefined;
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(forwardFocus.anchor.slice(0, -1), (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const newContent = [...oldListNode.content];
            const deleteFrom =
              forwardFocus.anchor[forwardFocus.anchor.length - 1];
            const deleteCount = forwardFocus.offset + 1;
            if (deleteFrom + deleteCount < oldListNode.content.length) {
              newFocusIndex = deleteFrom;
            } else if (deleteFrom > 0) {
              newFocusIndex = deleteFrom - 1;
            }
            newContent.splice(deleteFrom, deleteCount);
            return { ...oldListNode, content: newContent };
          }),
        );
        this.focus = {
          anchor:
            newFocusIndex === undefined
              ? forwardFocus.anchor.slice(0, -1)
              : [...forwardFocus.anchor.slice(0, -1), newFocusIndex],
          offset: 0,
        };
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
      } else if (ev.key === ";") {
        this.focus = { anchor: getPathToTip(this.focus), offset: 0 };
      }
    } else if (
      this.mode === Mode.InsertBefore ||
      this.mode === Mode.InsertAfter
    ) {
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

          let targetNodeIndex =
            this.focus.anchor[this.focus.anchor.length - 1] + this.focus.offset;
          if (this.mode === Mode.InsertBefore) {
            targetNodeIndex--;
          }
          let targetNode = newListNode.content[targetNodeIndex];
          if (!targetNode) {
            throw new Error("targetNode does not exist");
          }

          const pushNode = (node: Node) => {
            targetNodeIndex += 1;
            targetNode = node;
            newListNode.content.splice(targetNodeIndex, 0, targetNode);
            const newFocus = { ...this.focus, anchor: [...this.focus.anchor] };
            if (this.mode === Mode.InsertBefore) {
              newFocus.anchor[newFocus.anchor.length - 1] += 1;
            } else {
              newFocus.offset += 1;
            }
            this.focus = newFocus;
          };

          if (ev.key === oldListNode.separator) {
            if (targetNode.kind !== NodeKind.Token || targetNode.content) {
              pushNode(emptyToken);
              return newListNode;
            }

            return oldListNode;
          }

          const tokenPatterns = [
            {
              key: /^[a-zA-Z]$/,
              token: /^[a-zA-Z]*$/,
              syntaxKind: SyntaxKind.Identifier,
            },
            {
              key: /^\d$/,
              token: /^\d*$/,
              syntaxKind: SyntaxKind.NumericLiteral,
            },
            {
              key: /^[+\-*/]$/,
              token: /^[+\-*/]*$/,
              singleChar: true,
              syntaxKind: SyntaxKind.BinaryOperator,
            },
            {
              key: /^[.]$/,
              token: /^[.]*$/,
              syntaxKind: SyntaxKind.RawText,
            },
          ];
          for (const {
            key: keyPattern,
            token: tokenPattern,
            singleChar = false,
            syntaxKind,
          } of tokenPatterns) {
            if (ev.key.match(keyPattern)) {
              if (
                targetNode.kind !== NodeKind.Token ||
                !targetNode.content.match(tokenPattern) ||
                (targetNode.content.length === 1 && singleChar)
              ) {
                pushNode(emptyToken);
              }
              targetNode = {
                ...(targetNode as typeof emptyToken),
                content: targetNode.content + ev.key,
                syntaxKind,
              };
              newListNode.content[targetNodeIndex] = targetNode;
              return newListNode;
            }
          }

          const listDelimiters: [string, string][] = [["(", ")"]];
          for (const delimiters of listDelimiters) {
            if (ev.key === delimiters[0]) {
              pushNode({
                kind: NodeKind.List,
                delimiters,
                separator: " ",
                content: [emptyToken, emptyToken],
              });
              this.parentFocuses.push(this.focus);
              this.focus = {
                anchor: [
                  ...this.focus.anchor.slice(0, -1),
                  targetNodeIndex,
                  this.mode === Mode.InsertBefore ? 1 : 0,
                ],
                offset: 0,
              };
              return newListNode;
            } else if (ev.key === delimiters[1]) {
              if (oldListNode.delimiters[1] === delimiters[1]) {
                const parentFocus = this.parentFocuses.pop();
                if (parentFocus) {
                  this.focus = parentFocus;
                } else {
                  this.focus = {
                    anchor: listPath,
                    offset: 0,
                  };
                }
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
    if (this.mode === Mode.Normal && ev.key === ";" && ev.altKey) {
      this.focus = flipPathRange(this.focus);
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      this.mode = Mode.Normal;
      this.history = [];
      this.parentFocuses = [];
      this.fixFocus();
      this.removeEmptyTokens();
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Backspace"
    ) {
      if (this.history.length < 2) {
        return;
      }
      this.history.pop();
      const old = this.history.pop()!;
      this.doc = old.doc;
      this.focus = old.focus;
      this.parentFocuses = old.parentFocuses;
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
    this.history.push({
      doc: this.doc,
      focus: this.focus,
      parentFocuses: [...this.parentFocuses],
    });
    this._onUpdate({
      doc: this.doc,
      focus: this.focus,
      mode: this.mode,
    });
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

  private removeEmptyTokens() {
    const result = withoutEmptyTokens(this.doc, this.focus);
    this.doc = result.doc;
    this.focus = result.focus;
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
  selectionWrapper: css`
    position: relative;
    display: inline-block;
  `,
  separator: css`
    display: inline-block;
    white-space: pre;
  `,
  token: css`
    display: inline-block;
    white-space: pre;
  `,
  list: css`
    display: inline-block;
    white-space: pre;
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
  isLastOfFocus,
  showCursor,
  showCursorAfterThis,
  cursorOffset,
  trailingSeparator,
}: {
  node: Node;
  key: React.Key;
  focus: PathRange | undefined;
  isTipOfFocus: boolean;
  isLastOfFocus: boolean;
  showCursor: boolean;
  showCursorAfterThis: boolean;
  cursorOffset: -1 | 0;
  trailingSeparator: string;
}): React.ReactChild {
  const focused = focus !== undefined && focus.anchor.length === 0;
  let focusedChildRange: [number, number] | undefined;
  let tipOfFocusIndex: number | undefined;
  if (focus?.anchor.length) {
    const offset = focus.anchor.length === 1 ? focus.offset : 0;
    focusedChildRange = [focus.anchor[0], focus.anchor[0] + offset];
    if (focus.anchor.length === 1) {
      tipOfFocusIndex = focusedChildRange[1];
    }
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
          style={{
            color: node.syntaxKind === SyntaxKind.RawText ? "red" : undefined,
          }}
        >
          <div
            className={styles.selectionWrapper}
            style={{
              background: tokenBackground,
            }}
          >
            {node.content || "\u200b"}
            {showCursorAfterThis && <div className={styles.cursor} />}
            <div className={styles.separator}>
              {!isLastOfFocus && trailingSeparator}
            </div>
          </div>
          <div className={styles.separator}>
            {isLastOfFocus && trailingSeparator}
          </div>
        </div>
      );
    case NodeKind.List:
      return (
        <div key={key} className={styles.list}>
          <div
            className={styles.selectionWrapper}
            style={{
              background: tokenBackground,
            }}
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
                      ? {
                          anchor: focus!.anchor.slice(1),
                          offset: focus!.offset,
                        }
                      : undefined,
                  isTipOfFocus: i === tipOfFocusIndex,
                  isLastOfFocus:
                    !!focusedChildRange && i === focusedChildRange[1],
                  showCursor,
                  showCursorAfterThis:
                    showCursor &&
                    tipOfFocusIndex !== undefined &&
                    i === tipOfFocusIndex + cursorOffset,
                  cursorOffset,
                  trailingSeparator:
                    i + 1 === node.content.length ? "" : node.separator,
                }),
              )}
            </div>
            <div className={styles.listDelimiter}>{node.delimiters[1]}</div>
            {showCursorAfterThis && <div className={styles.cursor} />}
            <div className={styles.separator}>
              {!isLastOfFocus && trailingSeparator}
            </div>
          </div>
          <div className={styles.separator}>
            {isLastOfFocus && trailingSeparator}
          </div>
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
          isLastOfFocus: focus.anchor.length === 0,
          showCursor: mode === Mode.InsertBefore || mode === Mode.InsertAfter,
          showCursorAfterThis: false,
          cursorOffset: mode === Mode.InsertBefore ? -1 : 0,
          trailingSeparator: "",
        })}
      </div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      <pre>{JSON.stringify({ doc, focus }, null, 2)}</pre>
    </div>
  );
};
