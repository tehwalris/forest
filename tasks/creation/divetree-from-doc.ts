// src/logic/tree/display-line.ts

type Doc = any;
type LineCache = any;
type TightNode = any;
type TightSplitNode = any;
var NodeKind: any;
var Split: any;
var linesFromDoc: any;
var makeIndentNodes: any;

export function divetreeFromDoc(doc: Doc, cache: LineCache): TightNode {
  return {
    kind: NodeKind.TightSplit,
    split: Split.Stacked,
    growLast: true,
    children: [
      ...linesFromDoc(doc, cache).map(
        (line): TightSplitNode => ({
          kind: NodeKind.TightSplit,
          split: Split.SideBySide,
          growLast: true,
          children: [
            ...makeIndentNodes(line.indent),
            ...line.content,
            { kind: NodeKind.TightLeaf, size: [0, 0] },
          ],
        }),
      ),
      { kind: NodeKind.TightLeaf, size: [0, 0] },
    ],
  };
}
