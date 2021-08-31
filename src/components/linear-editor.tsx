import { css, keyframes } from "@emotion/css";
import * as React from "react";
import { useEffect, useState } from "react";
import { unreachable } from "../logic/util";

type Path = number[];
type EvenPathRange = { anchor: Path; offset: number };
type UnevenPathRange = { anchor: Path; tip: Path };

enum SyntaxKind {
  RawText,
  Identifier,
  NumericLiteral,
  BinaryOperator,
}

enum ParserKind {
  LooseExpression,
  TightExpression,
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
  parserKind: ParserKind;
  delimiters: [string, string];
  separator: string;
  content: Node[];
  equivalentToContent: boolean;
}

enum ParserInputKind {
  Token,
  ListNode,
}

type ParserInput = ParserInputToken | ParserInputListNode;

interface ParserInputToken {
  kind: ParserInputKind.Token;
  syntaxKind: SyntaxKind;
  content: string;
  nodeOffset: number;
  stringOffset: number;
}

interface ParserInputListNode {
  kind: ParserInputKind.ListNode;
  node: ListNode;
  nodeOffset: number;
}

interface ParserResult {
  parsed: Node[];
  remaining: ParserInput[];
}

type ParserFunction = (input: ParserInput[]) => ParserResult;

function parseLooseExpression(input: ParserInput[]): ParserResult {
  const parsed: Node[] = [];
  let remaining = [...input];
  while (remaining.length) {
    const item = remaining[0];

    if (
      item.kind === ParserInputKind.ListNode &&
      item.node.delimiters[0] === "("
    ) {
      parsed.push(item.node);
      remaining.shift();
      continue;
    }

    if (
      item.kind === ParserInputKind.Token &&
      item.syntaxKind === SyntaxKind.BinaryOperator
    ) {
      parsed.push({
        kind: NodeKind.Token,
        syntaxKind: item.syntaxKind,
        content: item.content,
      });
      remaining.shift();
      continue;
    }

    const tightExpressionResult = parseTightExpression(remaining);
    if (!tightExpressionResult.parsed.length) {
      break;
    }
    if (tightExpressionResult.remaining.length >= remaining.length) {
      throw new Error("parseTightExpression gave result without taking input");
    }
    parsed.push({
      kind: NodeKind.List,
      parserKind: ParserKind.TightExpression,
      delimiters: ["", ""],
      separator: ".",
      content: tightExpressionResult.parsed,
      equivalentToContent: true,
    });
    remaining = [...tightExpressionResult.remaining];
  }
  return { parsed, remaining };
}

function parseTightExpression(input: ParserInput[]): ParserResult {
  function isIdentifier(
    item: ParserInput,
  ): item is ParserInputToken & { syntaxKind: SyntaxKind.Identifier } {
    return (
      item.kind === ParserInputKind.Token &&
      item.syntaxKind === SyntaxKind.Identifier
    );
  }

  const parsed: Node[] = [];
  const remaining = [...input];
  while (remaining.length) {
    const item = remaining[0];
    if (isIdentifier(item)) {
      parsed.push({
        kind: NodeKind.Token,
        syntaxKind: item.syntaxKind,
        content: item.content,
      });
      remaining.shift();
      continue;
    }
    if (
      item.kind === ParserInputKind.Token &&
      item.syntaxKind === SyntaxKind.RawText &&
      item.content === "." &&
      remaining.length > 1 &&
      isIdentifier(remaining[1])
    ) {
      remaining.shift();
      continue;
    }
    break;
  }
  return { parsed, remaining };
}

const parserFunctionsByKind: { [K in ParserKind]: ParserFunction } = {
  [ParserKind.LooseExpression]: parseLooseExpression,
  [ParserKind.TightExpression]: parseTightExpression,
};

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
    parserKind: ParserKind.LooseExpression,
    delimiters: ["", ""],
    separator: " ",
    content: [],
    equivalentToContent: true,
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

function parserInputTokensFromString(
  input: string,
  nodeOffset: number,
): ParserInputToken[] {
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
      syntaxKind: SyntaxKind.RawText,
    },
  ];

  const makeEmptyToken = (): ParserInputToken => ({
    kind: ParserInputKind.Token,
    syntaxKind: SyntaxKind.RawText,
    content: "",
    nodeOffset,
    stringOffset: 0,
  });

  let lastToken = makeEmptyToken();
  const output = [lastToken];
  charLoop: for (const [stringOffset, char] of [...input].entries()) {
    for (const {
      key: keyPattern,
      token: tokenPattern,
      singleChar = false,
      syntaxKind,
    } of tokenPatterns) {
      if (keyPattern && !char.match(keyPattern)) {
        continue;
      }
      if (
        (!tokenPattern && lastToken.syntaxKind !== syntaxKind) ||
        (tokenPattern && !lastToken.content.match(tokenPattern)) ||
        (lastToken.content.length === 1 && singleChar)
      ) {
        lastToken = makeEmptyToken();
        output.push(lastToken);
      }
      lastToken.stringOffset = stringOffset;
      lastToken.syntaxKind = syntaxKind;
      lastToken.content += char;
      continue charLoop;
    }
    throw new Error(`unhandled char: ${char}`);
  }

  return output.filter((t) => t.content.trim());
}

function tryConvertNodesToParserInput(
  nodes: Node[],
): ParserInput[] | undefined {
  const result: ParserInput[] = [];
  for (const [nodeOffset, node] of nodes.entries()) {
    switch (node.kind) {
      case NodeKind.Token:
        if (node.syntaxKind !== SyntaxKind.RawText) {
          return undefined;
        }
        result.push(...parserInputTokensFromString(node.content, nodeOffset));
        break;
      case NodeKind.List:
        result.push({ kind: ParserInputKind.ListNode, node, nodeOffset });
        break;
      default:
        return unreachable(node);
    }
  }
  return result;
}

class PartialParseError extends Error {
  constructor() {
    super("not all input could be parsed");
    Object.setPrototypeOf(this, PartialParseError.prototype);
  }
}

function reparseNodes(
  oldNodesBeforeParse: Node[],
  parserKind: ParserKind,
  throwOnPartialParse: boolean,
): { parsed: Node[]; remaining: Node[] } {
  const oldNodes = oldNodesBeforeParse.flatMap((oldNode) => {
    if (oldNode.kind === NodeKind.Token) {
      return [oldNode];
    }
    const { parsed, remaining } = reparseNodes(
      oldNode.content,
      oldNode.parserKind,
      throwOnPartialParse,
    );
    if (oldNode.equivalentToContent) {
      return [{ ...oldNode, content: parsed }, ...remaining];
    } else {
      return [{ ...oldNode, content: [...parsed, ...remaining] }];
    }
  });

  const parserInput = tryConvertNodesToParserInput(oldNodes);
  if (!parserInput?.length) {
    return { parsed: oldNodes, remaining: [] };
  }

  const parserResult = parserFunctionsByKind[parserKind](parserInput);
  if (!parserResult.remaining.length) {
    return { parsed: parserResult.parsed, remaining: [] };
  }

  const remainingNodes: Node[] = [];
  const firstRemainingInput = parserResult.remaining[0];
  if (firstRemainingInput.kind === ParserInputKind.Token) {
    const oldRawTextNode = oldNodes[firstRemainingInput.nodeOffset];
    if (
      oldRawTextNode?.kind !== NodeKind.Token ||
      oldRawTextNode.syntaxKind !== SyntaxKind.RawText
    ) {
      throw new Error("remaining node has unexpected type");
    }
    const newRawTextNode = {
      ...oldRawTextNode,
      content: oldRawTextNode.content
        .slice(firstRemainingInput.stringOffset)
        .trim(),
    };
    if (newRawTextNode.content) {
      remainingNodes.push(newRawTextNode);
    }
  } else {
    remainingNodes.push(oldNodes[firstRemainingInput.nodeOffset]);
  }
  remainingNodes.push(...oldNodes.slice(firstRemainingInput.nodeOffset + 1));

  if (remainingNodes.length && throwOnPartialParse) {
    throw new PartialParseError();
  }

  return { parsed: parserResult.parsed, remaining: remainingNodes };
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
          .filter(([r, _i]) => r)
          .map(([_r, i]) => i)
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

  constructor(
    private _onUpdate: (stuff: {
      doc: Doc;
      focus: EvenPathRange;
      mode: Mode;
    }) => void,
  ) {}

  onKeyPress = (ev: KeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter" && ev.ctrlKey) {
        const evenFocus = asEvenPathRange(this.focus);
        if (evenFocus.anchor.length === 0) {
          return;
        }
        const forwardFocus =
          evenFocus.offset < 0 ? flipEvenPathRange(evenFocus) : evenFocus;
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
        const oldListNode = nodeGetByPath(
          this.doc.root,
          forwardFocus.anchor.slice(0, -1),
        );
        if (oldListNode?.kind !== NodeKind.List) {
          throw new Error("oldListNode is not a list");
        }
        const reparsedResult = reparseNodes(
          focusedNodes,
          oldListNode.parserKind,
          false,
        );
        const reparsedNodes = [
          ...reparsedResult.parsed,
          ...reparsedResult.remaining,
        ];
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
        this.focus = asUnevenPathRange({
          ...forwardFocus,
          offset: reparsedNodes.length - 1,
        });
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
            this.insertedRange = {
              ...this.insertedRange!,
              offset: this.insertedRange!.offset + 1,
            };
          };

          const listDelimiters: [string, string][] = [["(", ")"]];
          for (const delimiters of listDelimiters) {
            if (ev.key === delimiters[0]) {
              pushNode({
                kind: NodeKind.List,
                parserKind: ParserKind.LooseExpression,
                delimiters,
                separator: " ",
                content: [emptyToken, emptyToken],
                equivalentToContent: false,
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

          if (
            targetNode.kind !== NodeKind.Token ||
            targetNode.syntaxKind !== SyntaxKind.RawText
          ) {
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
      const oldFirstIndex =
        this.insertedRange.anchor[this.insertedRange.anchor.length - 1];
      const oldLastIndex = oldFirstIndex + this.insertedRange.offset;

      try {
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(
            this.insertedRange.anchor.slice(0, -1),
            (oldListNode) => {
              if (oldListNode?.kind !== NodeKind.List) {
                throw new Error("oldListNode is not a list");
              }
              const reparsedResult = reparseNodes(
                oldListNode.content.slice(oldFirstIndex, oldLastIndex + 1),
                oldListNode.parserKind,
                true,
              );
              const reparsedNodes = [
                ...reparsedResult.parsed,
                ...reparsedResult.remaining,
              ];

              const newListContent = [...oldListNode.content];
              newListContent.splice(
                oldFirstIndex,
                oldLastIndex - oldFirstIndex + 1,
                ...reparsedNodes,
              );

              const focusOffset =
                newListContent.length - oldListNode.content.length;
              let evenFocus =
                this.parentFocuses[0] || asEvenPathRange(this.focus);
              if (this.mode === Mode.InsertBefore) {
                evenFocus.anchor[evenFocus.anchor.length - 1] += focusOffset;
              } else {
                evenFocus.offset += focusOffset;
              }
              this.focus = asUnevenPathRange(evenFocus);

              return { ...oldListNode, content: newListContent };
            },
          ),
        );
      } catch (err) {
        if (err instanceof PartialParseError) {
          return;
        }
        throw err;
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
      this.onUpdate();
    }
  };

  private tryMoveToParent() {
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
    }
    this.lastMode = this.mode;
    this._onUpdate({
      doc: this.doc,
      focus: asEvenPathRange(this.focus),
      mode: this.mode,
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
    focus: EvenPathRange;
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
