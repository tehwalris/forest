import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import ts from "typescript";
import { CompilerHost } from "../logic/providers/typescript/compiler-host";
import { unreachable } from "../logic/util";

const exampleFile = `
console.log("walrus")
  .test("bla");

if (Date.now() % 100 == 0) {
  console.log("lucky you");
}
`;

type Path = number[];
type EvenPathRange = { anchor: Path; offset: number };
type UnevenPathRange = { anchor: Path; tip: Path };

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

interface TextRange {
  pos: number;
  end: number;
}

type Node = TokenNode | ListNode;

interface TokenNode extends TextRange {
  kind: NodeKind.Token;
  syntaxKind: SyntaxKind;
  content: string;
}

interface ListNode extends TextRange {
  kind: NodeKind.List;
  delimiters: [string, string];
  content: Node[];
  equivalentToContent: boolean;
}

function astFromTypescriptFileContent(fileContent: string) {
  const compilerHost = new CompilerHost();
  const file = compilerHost.addFile(
    "file.ts",
    fileContent,
    ts.ScriptTarget.ES5,
  );
  return file;
}

function docFromAst(file: ts.SourceFile): Doc {
  for (const s of file.statements) {
    console.log(
      s.getFullText(file).length,
      s.getText(file).length,
      s.getLeadingTriviaWidth(file),
      s,
    );
  }
  return {
    root: {
      kind: NodeKind.List,
      delimiters: ["", ""],
      content: file.statements.map((s) => ({
        kind: NodeKind.Token,
        syntaxKind: SyntaxKind.RawText,
        content: s.getText(file),
        pos: s.pos,
        end: s.end,
      })),
      equivalentToContent: true,
      pos: file.pos,
      end: file.end,
    },
    text: file.text,
  };
}

function isRawText(
  node: Node,
): node is TokenNode & { syntaxKind: SyntaxKind.RawText } {
  return node.kind === NodeKind.Token && node.syntaxKind === SyntaxKind.RawText;
}

interface Doc {
  root: ListNode;
  text: string;
}

const emptyToken: TokenNode = {
  kind: NodeKind.Token,
  syntaxKind: SyntaxKind.RawText,
  content: "",
  pos: -1,
  end: -1,
};

const emptyDoc: Doc = {
  root: {
    kind: NodeKind.List,
    delimiters: ["", ""],
    content: [],
    equivalentToContent: true,
    pos: 0,
    end: 0,
  },
  text: "",
};

const initialDoc = docFromAst(astFromTypescriptFileContent(exampleFile));

function docMapRoot(doc: Doc, cb: (node: ListNode) => Node): Doc {
  const newRoot = cb(doc.root);
  if (newRoot === doc.root) {
    return doc;
  }
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("newRoot must be a ListNode");
  }
  return { ...doc, root: newRoot };
}

function asUnevenPathRange(even: EvenPathRange): UnevenPathRange {
  if (!even.offset) {
    return { anchor: even.anchor, tip: even.anchor };
  }
  if (!even.anchor.length) {
    throw new Error("offset at root is invalid");
  }
  const tip = [...even.anchor];
  tip[tip.length - 1] += even.offset;
  return { anchor: even.anchor, tip };
}

function asEvenPathRange(uneven: UnevenPathRange): EvenPathRange {
  const commonPrefix = [];
  let firstUnequal: { anchor: number; tip: number } | undefined;
  for (let i = 0; i < Math.min(uneven.anchor.length, uneven.tip.length); i++) {
    if (uneven.anchor[i] === uneven.tip[i]) {
      commonPrefix.push(uneven.anchor[i]);
    } else {
      firstUnequal = { anchor: uneven.anchor[i], tip: uneven.tip[i] };
      break;
    }
  }
  return firstUnequal
    ? {
        anchor: [...commonPrefix, firstUnequal.anchor],
        offset: firstUnequal.tip - firstUnequal.anchor,
      }
    : { anchor: commonPrefix, offset: 0 };
}

function pathsAreEqual(a: Path, b: Path): boolean {
  return a === b || (a.length === b.length && a.every((v, i) => v === b[i]));
}

function evenPathRangesAreEqual(a: EvenPathRange, b: EvenPathRange): boolean {
  return (
    a === b || (pathsAreEqual(a.anchor, b.anchor) && a.offset === b.offset)
  );
}

function unevenPathRangesAreEqual(
  a: UnevenPathRange,
  b: UnevenPathRange,
): boolean {
  return (
    a === b ||
    (pathsAreEqual(a.anchor, b.anchor) && pathsAreEqual(a.tip, b.tip))
  );
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

function flipEvenPathRange(oldPathRange: EvenPathRange): EvenPathRange {
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

function flipUnevenPathRange({
  anchor,
  tip,
}: UnevenPathRange): UnevenPathRange {
  return { anchor: tip, tip: anchor };
}

function getPathToTip(pathRange: EvenPathRange): Path {
  const path = [...pathRange.anchor];
  if (!path.length) {
    return [];
  }
  path[path.length - 1] += pathRange.offset;
  return path;
}

function withoutInvisibleNodes(
  doc: Doc,
  focus: EvenPathRange,
): { doc: Doc; focus: EvenPathRange } {
  if (focus.offset < 0) {
    const result = withoutInvisibleNodes(doc, flipEvenPathRange(focus));
    return { doc: result.doc, focus: flipEvenPathRange(result.focus) };
  }
  const result = _withoutInvisibleNodes(doc.root, focus);
  return {
    doc: result ? docMapRoot(doc, () => result.node) : emptyDoc,
    focus: result?.focus || { anchor: [], offset: 0 },
  };
}

function _withoutInvisibleNodes(
  node: Node,
  focus: EvenPathRange | undefined,
): { node: Node; focus: EvenPathRange | undefined } | undefined {
  if (node.kind === NodeKind.Token && node.content) {
    return { node, focus };
  }
  if (node.kind === NodeKind.Token && !node.content) {
    return undefined;
  } else if (node.kind === NodeKind.List) {
    if (!node.content.length) {
      if (node.equivalentToContent) {
        return undefined;
      }
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
      _withoutInvisibleNodes(
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
    const filteredOldIndices = results
      .map((r, i) => [r, i] as const)
      .filter(([r, _i]) => r)
      .map(([_r, i]) => i);
    const newNode = {
      ...node,
      content: results
        .map((r) => r?.node)
        .filter((v) => v)
        .map((v) => v!),
    };

    if (!newNode.content.length && node.equivalentToContent) {
      return undefined;
    }
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
        const newFocusedChildIndex =
          filteredOldIndices.indexOf(focusedChildIndex);
        return {
          node: newNode,
          focus: {
            anchor: [newFocusedChildIndex, ...childFocus.anchor],
            offset: childFocus.offset,
          },
        };
      } else {
        const minIndexAfterFocused = filteredOldIndices.findIndex(
          (i) => i > focusedChildIndex!,
        );
        const maxIndexBeforeFocused = Math.max(
          ...filteredOldIndices.filter((i) => i < focusedChildIndex!),
          -1,
        );
        const newFocusedChildIndex =
          minIndexAfterFocused >= 0
            ? minIndexAfterFocused
            : maxIndexBeforeFocused;
        return {
          node: newNode,
          focus: { anchor: [newFocusedChildIndex], offset: 0 },
        };
      }
    }
    if (!directlyFocusedChildRange) {
      return { node: newNode, focus: focus };
    }
    {
      const minIndexAfterFocused = filteredOldIndices.findIndex(
        (i) => i > directlyFocusedChildRange![1],
      );
      const maxIndexBeforeFocused = Math.max(
        ...filteredOldIndices.filter((i) => i < directlyFocusedChildRange![1]),
        -1,
      );
      const newFocusedChildIndex =
        minIndexAfterFocused >= 0
          ? minIndexAfterFocused
          : maxIndexBeforeFocused;
      return {
        node: newNode,
        focus: { anchor: [newFocusedChildIndex], offset: 0 },
      };
    }
  }
}

enum Mode {
  Normal,
  InsertBefore,
  InsertAfter,
}

class DocManager {
  private doc: Doc = initialDoc;
  private focus: UnevenPathRange = { anchor: [], tip: [] };
  private parentFocuses: EvenPathRange[] = [];
  private history: {
    doc: Doc;
    focus: UnevenPathRange;
    parentFocuses: EvenPathRange[];
    insertedRange: EvenPathRange;
  }[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private insertedRange: EvenPathRange | undefined;
  private liveReparse = true;

  constructor(
    private _onUpdate: (stuff: {
      doc: Doc;
      focus: EvenPathRange;
      mode: Mode;
      liveReparse: boolean;
    }) => void,
  ) {}

  forceUpdate() {
    if (this.mode !== Mode.Normal) {
      throw new Error("forceUpdate can only be called in normal mode");
    }
    this.onUpdate();
    this.history = [];
  }

  setLiveReparse(v: boolean) {
    this.liveReparse = v;
    this.reportUpdate();
  }

  onKeyPress = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter") {
        const evenFocus = asEvenPathRange(this.focus);
        if (evenFocus.offset !== 0) {
          return;
        }
        const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
        if (focusedNode?.kind !== NodeKind.List || focusedNode.content.length) {
          return;
        }
        this.doc = docMapRoot(this.doc, (root) =>
          nodeSetByPath(root, evenFocus.anchor, {
            ...focusedNode,
            content: [emptyToken],
          }),
        );
        this.focus = asUnevenPathRange({
          anchor: [...evenFocus.anchor, 0],
          offset: 0,
        });
        this.insertedRange = {
          anchor: [...evenFocus.anchor, 0],
          offset: 0,
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "i") {
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        const listPath = evenFocus.anchor.slice(0, -1);
        const listNode = nodeGetByPath(this.doc.root, listPath);
        if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
          return;
        }
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const newTokenIndex = evenFocus.anchor[evenFocus.anchor.length - 1];
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
        evenFocus = {
          anchor: [...evenFocus.anchor.slice(0, -1), newTokenIndex + 1],
          offset: evenFocus.offset,
        };
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);
        this.insertedRange = {
          anchor: [...evenFocus.anchor.slice(0, -1), newTokenIndex],
          offset: 0,
        };
        this.mode = Mode.InsertBefore;
      } else if (ev.key === "a") {
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        const listPath = evenFocus.anchor.slice(0, -1);
        const listNode = nodeGetByPath(this.doc.root, listPath);
        if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
          return;
        }
        if (evenFocus.offset > 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const newTokenIndex = evenFocus.anchor[evenFocus.anchor.length - 1] + 1;
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
        evenFocus = {
          anchor: [...evenFocus.anchor.slice(0, -1), newTokenIndex],
          offset: evenFocus.offset - 1,
        };
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);
        this.insertedRange = {
          anchor: [...evenFocus.anchor.slice(0, -1), newTokenIndex],
          offset: 0,
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "d") {
        const evenFocus = asEvenPathRange(this.focus);
        let forwardFocus =
          evenFocus.offset < 0 ? flipEvenPathRange(evenFocus) : evenFocus;
        if (evenFocus.anchor.length === 0) {
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
        this.focus = asUnevenPathRange({
          anchor:
            newFocusIndex === undefined
              ? forwardFocus.anchor.slice(0, -1)
              : [...forwardFocus.anchor.slice(0, -1), newFocusIndex],
          offset: 0,
        });
      } else if (ev.key === "l") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, false));
      } else if (ev.key === "L") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, true));
      } else if (ev.key === "h") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, false));
      } else if (ev.key === "H") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, true));
      } else if (ev.key === "k") {
        this.tryMoveOutOfList();
      } else if (ev.key === "K") {
        this.tryMoveToParent();
      } else if (ev.key === "j") {
        this.tryMoveIntoList();
      } else if (ev.key === ";") {
        this.focus = asUnevenPathRange({
          anchor: getPathToTip(asEvenPathRange(this.focus)),
          offset: 0,
        });
      }
    } else if (
      this.mode === Mode.InsertBefore ||
      this.mode === Mode.InsertAfter
    ) {
      ev.preventDefault();
      ev.stopPropagation();
      let evenFocus = asEvenPathRange(this.focus);
      if (!evenFocus.anchor.length) {
        throw new Error("root focused in insert mode");
      }
      const listPath = evenFocus.anchor.slice(0, -1);
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
            evenFocus.anchor[evenFocus.anchor.length - 1] + evenFocus.offset;
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
            const newFocus = { ...evenFocus, anchor: [...evenFocus.anchor] };
            if (this.mode === Mode.InsertBefore) {
              newFocus.anchor[newFocus.anchor.length - 1] += 1;
            } else {
              newFocus.offset += 1;
            }
            evenFocus = newFocus;
            this.focus = asUnevenPathRange(evenFocus);
            if (!this.parentFocuses.length) {
              this.insertedRange = {
                ...this.insertedRange!,
                offset: this.insertedRange!.offset + 1,
              };
            }
          };

          const listDelimiters: [string, string][] = [
            ["(", ")"],
            ["{", "}"],
            ["[", "]"],
          ];
          for (const delimiters of listDelimiters) {
            if (ev.key === delimiters[0]) {
              pushNode({
                kind: NodeKind.List,
                delimiters,
                content: [emptyToken, emptyToken],
                equivalentToContent: false,
                pos: -1,
                end: -1,
              });
              this.parentFocuses.push(evenFocus);
              this.focus = asUnevenPathRange({
                anchor: [
                  ...evenFocus.anchor.slice(0, -1),
                  targetNodeIndex,
                  this.mode === Mode.InsertBefore ? 1 : 0,
                ],
                offset: 0,
              });
              return newListNode;
            } else if (ev.key === delimiters[1]) {
              if (oldListNode.delimiters[1] === delimiters[1]) {
                const parentFocus = this.parentFocuses.pop();
                if (parentFocus) {
                  this.focus = asUnevenPathRange(parentFocus);
                } else {
                  this.focus = asUnevenPathRange({
                    anchor: listPath,
                    offset: 0,
                  });
                }
                return oldListNode;
              }
            }
          }

          if (ev.key.length !== 1) {
            return oldListNode;
          }

          if (!isRawText(targetNode)) {
            pushNode(emptyToken);
          }
          targetNode = {
            ...(targetNode as typeof emptyToken),
            content: targetNode.content + ev.key,
          };
          newListNode.content[targetNodeIndex] = targetNode;
          return newListNode;
        }),
      );
    }

    this.onUpdate();
  };

  onKeyDown = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal && ev.key === ";" && ev.altKey) {
      this.focus = flipUnevenPathRange(this.focus);
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      if (!this.insertedRange) {
        throw new Error(
          "this.insertedRange is undefined when exiting in insert mode",
        );
      }

      if (this.history.length > 1) {
        return;
      }

      this.mode = Mode.Normal;
      this.history = [];
      this.parentFocuses = [];
      this.removeInvisibleNodes();
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
      this.insertedRange = old.insertedRange;
      this.onUpdate();
    }
  };

  onKeyUp = (ev: KeyboardEvent) => {
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  private tryMoveOutOfList() {
    let evenFocus = asEvenPathRange(this.focus);
    while (evenFocus.anchor.length >= 2) {
      evenFocus = {
        anchor: evenFocus.anchor.slice(0, -1),
        offset: 0,
      };
      const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
      if (
        focusedNode?.kind === NodeKind.List &&
        !focusedNode.equivalentToContent
      ) {
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }
    }
  }

  private tryMoveIntoList() {
    const evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset !== 0) {
      return;
    }
    const listPath = evenFocus.anchor;
    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
      return;
    }
    this.focus = asUnevenPathRange({
      anchor: [...listPath, 0],
      offset: listNode.content.length - 1,
    });
  }

  private tryMoveToParent() {
    let evenFocus = asEvenPathRange(this.focus);
    while (evenFocus.anchor.length) {
      const parentPath = evenFocus.anchor.slice(0, -1);
      const parentNode = nodeGetByPath(this.doc.root, parentPath);
      if (parentNode?.kind !== NodeKind.List) {
        throw new Error("parentNode is not a list");
      }

      const wholeParentSelected =
        Math.abs(evenFocus.offset) + 1 === parentNode.content.length;
      if (!wholeParentSelected) {
        evenFocus = {
          anchor: [...parentPath, 0],
          offset: parentNode.content.length - 1,
        };
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }

      evenFocus = {
        anchor: parentPath,
        offset: 0,
      };
    }

    this.focus = asUnevenPathRange(evenFocus);
    return;
  }

  private tryMoveThroughLeaves(offset: -1 | 1, extend: boolean) {
    let currentPath = [...this.focus.tip];
    while (true) {
      if (!currentPath.length) {
        return;
      }
      const siblingPath = [...currentPath];
      siblingPath[siblingPath.length - 1] += offset;
      if (nodeGetByPath(this.doc.root, siblingPath)) {
        currentPath = siblingPath;
        break;
      }
      currentPath.pop();
    }

    while (true) {
      const currentNode = nodeGetByPath(this.doc.root, currentPath)!;
      if (currentNode.kind !== NodeKind.List || !currentNode.content.length) {
        break;
      }
      const childPath = [
        ...currentPath,
        offset === -1 ? currentNode.content.length - 1 : 0,
      ];
      if (!nodeGetByPath(this.doc.root, childPath)) {
        break;
      }
      currentPath = childPath;
    }

    this.focus = extend
      ? { anchor: this.focus.anchor, tip: currentPath }
      : { anchor: currentPath, tip: currentPath };
  }

  private whileUnevenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (unevenPathRangesAreEqual(this.focus, oldFocus)) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private untilEvenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (unevenPathRangesAreEqual(this.focus, oldFocus)) {
        // avoid infinite loop (if the uneven focus didn't change, it probably never will, so the even focus wont either)
        return;
      }
      if (
        !evenPathRangesAreEqual(
          asEvenPathRange(this.focus),
          asEvenPathRange(oldFocus),
        )
      ) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private onUpdate() {
    if (this.mode === Mode.Normal) {
      this.removeInvisibleNodes();
    }
    this.whileUnevenFocusChanges(() => this.normalizeFocus());
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      if (this.lastMode !== this.mode) {
        this.history = [];
      }
      if (!this.insertedRange) {
        throw new Error("this.insertedRange is undefined in insert mode");
      }
      this.history.push({
        doc: this.doc,
        focus: this.focus,
        parentFocuses: [...this.parentFocuses],
        insertedRange: this.insertedRange,
      });
      if (this.liveReparse) {
      }
    }
    this.lastMode = this.mode;

    this.reportUpdate();
  }

  private reportUpdate() {
    this._onUpdate({
      doc: this.doc,
      focus: asEvenPathRange(this.focus),
      mode: this.mode,
      liveReparse: this.liveReparse,
    });
  }

  private normalizeFocus() {
    const evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset !== 0) {
      return;
    }
    const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
    if (!focusedNode) {
      throw new Error("invalid focus");
    }
    if (
      focusedNode.kind !== NodeKind.List ||
      !focusedNode.equivalentToContent ||
      !focusedNode.content.length
    ) {
      return;
    }
    this.focus = {
      anchor: [...evenFocus.anchor, 0],
      tip: [...evenFocus.anchor, focusedNode.content.length - 1],
    };
  }

  private removeInvisibleNodes() {
    const anchorResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.anchor,
      offset: 0,
    });
    const tipResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.tip,
      offset: 0,
    });
    this.doc = anchorResult.doc;
    this.focus = {
      anchor: anchorResult.focus.anchor,
      tip: tipResult.focus.anchor,
    };
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
  focus: EvenPathRange | undefined;
  isTipOfFocus: boolean;
  isLastOfFocus: boolean;
  showCursor: boolean;
  showCursorAfterThis: boolean;
  cursorOffset: -1 | 0;
  trailingSeparator: string;
}): React.ReactNode {
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
            color: isRawText(node) ? "red" : undefined,
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
                  trailingSeparator: "",
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

enum CharSelection {
  None = 0,
  Normal = 1,
  Tip = 2,
}

function setCharSelections({
  selectionsByChar,
  node,
  focus,
  isTipOfFocus,
}: {
  selectionsByChar: Uint8Array;
  node: Node;
  focus: EvenPathRange | undefined;
  isTipOfFocus: boolean;
}) {
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

  if (focused) {
    selectionsByChar.fill(
      isTipOfFocus ? CharSelection.Tip : CharSelection.Normal,
      node.pos,
      node.end,
    );
  }

  if (node.kind === NodeKind.List) {
    for (const [i, c] of node.content.entries()) {
      setCharSelections({
        selectionsByChar,
        node: c,
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
      });
    }
  }
}

interface DocRenderLine {
  regions: DocRenderRegion[];
}

interface DocRenderRegion {
  text: string;
  selection: CharSelection;
}

function splitDocRenderRegions(
  text: string,
  selectionsByChar: Uint8Array,
): DocRenderRegion[] {
  if (text.length !== selectionsByChar.length) {
    throw new Error("text and selectionsByChar must have same length");
  }

  if (!selectionsByChar.length) {
    return [];
  }

  const regions: DocRenderRegion[] = [];
  let start = 0;
  for (const [i, selection] of selectionsByChar.entries()) {
    const isDifferent = selection !== selectionsByChar[start];
    const isLast = i + 1 === selectionsByChar.length;
    const stopBecauseLast = !isDifferent && isLast;
    if (isDifferent || isLast) {
      const end = stopBecauseLast ? i + 1 : i;
      regions.push({
        text: text.slice(start, end),
        selection: selectionsByChar[start],
      });
      start = end;
    }
  }
  return regions;
}

function renderDoc(doc: Doc, focus: EvenPathRange): React.ReactNode {
  const selectionsByChar = new Uint8Array(doc.text.length);
  setCharSelections({
    selectionsByChar,
    node: doc.root,
    focus,
    isTipOfFocus: false,
  });

  const lines: DocRenderLine[] = [];
  let pos = 0;
  for (const lineText of doc.text.split("\n")) {
    lines.push({
      regions: splitDocRenderRegions(
        lineText,
        selectionsByChar.subarray(pos, pos + lineText.length),
      ),
    });
    pos += lineText.length + 1;
  }

  const backgroundsBySelection: { [K in CharSelection]: string | undefined } = {
    [CharSelection.None]: undefined,
    [CharSelection.Normal]: "rgba(11, 83, 255, 0.15)",
    [CharSelection.Tip]: "rgba(11, 83, 255, 0.37)",
  };

  return (
    <div style={{ whiteSpace: "pre" }}>
      {lines.map((line, iLine) => (
        <div key={iLine}>
          {!line.regions.length && <br />}
          {line.regions.map((region, iRegion) => (
            <span
              key={iRegion}
              style={{ background: backgroundsBySelection[region.selection] }}
            >
              {region.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export const LinearEditor = () => {
  const [{ doc, focus, mode, liveReparse }, setStuff] = useState<{
    doc: Doc;
    focus: EvenPathRange;
    mode: Mode;
    liveReparse: boolean;
  }>({
    doc: emptyDoc,
    focus: { anchor: [], offset: 0 },
    mode: Mode.Normal,
    liveReparse: true,
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
    docManager.forceUpdate();
  }, [docManager]);

  useEffect(() => {
    const options: EventListenerOptions = { capture: true };
    document.addEventListener("keypress", docManager.onKeyPress, options);
    document.addEventListener("keydown", docManager.onKeyDown, options);
    document.addEventListener("keyup", docManager.onKeyUp, options);
    return () => {
      document.removeEventListener("keypress", docManager.onKeyPress, options);
      document.removeEventListener("keydown", docManager.onKeyDown, options);
      document.removeEventListener("keyup", docManager.onKeyUp, options);
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
      <div className={styles.doc}>{renderDoc(doc, focus)}</div>
      <div className={styles.modeLine}>Mode: {Mode[mode]}</div>
      <label>
        Live reparse{" "}
        <input
          type="checkbox"
          checked={liveReparse}
          tabIndex={-1}
          onChange={(ev) => docManager.setLiveReparse(ev.target.checked)}
        />
      </label>
      <pre>
        {JSON.stringify(
          {
            focus,
            tip: nodeGetByPath(doc.root, flipEvenPathRange(focus).anchor),
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
};
