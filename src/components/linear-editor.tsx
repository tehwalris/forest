import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { unreachable } from "../logic/util";

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

const emptyDoc: Doc = {
  root: { kind: NodeKind.List, delimiters: ["", ""], content: [] },
};

function docGetLastToken(doc: Doc): TokenNode | undefined {
  return nodeGetLastToken(doc.root);
}

function docSetLastToken(doc: Doc, newToken: TokenNode): Doc {
  const newRoot = nodeSetLastToken(doc.root, newToken);
  if (newRoot === doc.root) {
    return doc;
  }
  if (newRoot.kind !== NodeKind.List) {
    throw new Error("newRoot must be a list");
  }
  return { ...doc, root: newRoot };
}

function docAppendEmptyToken(doc: Doc): Doc {
  return {
    root: {
      ...doc.root,
      content: [...doc.root.content, { kind: NodeKind.Token, content: "" }],
    },
  };
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
          a === undefined && nodeGetLastToken(c) ? i : undefined,
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

class DocManager {
  private doc: Doc = emptyDoc;

  constructor(private onDocUpdate: (doc: Doc) => void) {}

  onKeyPress = (ev: KeyboardEvent) => {
    console.log("onKeyPress", ev.key);

    if (!docGetLastToken(this.doc)) {
      this.doc = docAppendEmptyToken(this.doc);
    }
    this.doc = docSetLastToken(this.doc, {
      kind: NodeKind.Token,
      content: "walrus",
    });
    this.onDocUpdate(this.doc);
  };
}

export const LinearEditor = () => {
  const [doc, setDoc] = useState(emptyDoc);
  const [docManager, setDocManager] = useState(new DocManager(setDoc));
  useEffect(() => {
    setDocManager((oldDocManager) => {
      const newDocManager = new DocManager(setDoc);
      (newDocManager as any).doc = (oldDocManager as any).doc;
      return newDocManager;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DocManager]);

  useEffect(() => {
    document.addEventListener("keypress", docManager.onKeyPress);
    return () => {
      document.removeEventListener("keypress", docManager.onKeyPress);
    };
  }, [docManager]);

  return <div>{JSON.stringify(doc, null, 2)}</div>;
};
