import {
  Node,
  DisplayInfoPriority,
  LabelStyle,
  DisplayInfo,
  LabelPart,
  SemanticColor,
  BuildDivetreeDisplayTreeArgs,
} from "../../tree/node";
import * as ts from "typescript";
import * as R from "ramda";
import { noCase } from "change-case";
import { ParentPathElement } from "../../parent-index";
import {
  LooseNode,
  NodeKind,
  RootNode as DivetreeDisplayRootNode,
  Split,
  TightNode,
} from "divetree-core";
export function tryExtractName(node: Node<unknown>): string | undefined {
  const nameNode = node.getByPath(["name"]);
  if (!nameNode) {
    return undefined;
  }
  const buildResult = nameNode.build();
  if (!buildResult.ok) {
    return undefined;
  }
  const text = buildResult.value?.text;
  if (typeof text !== "string") {
    return undefined;
  }
  return text;
}
export type Enchancer<T extends Node<ts.Node>> = (
  node: T,
  parentPath: ParentPathElement[],
) => {
  displayInfo: DisplayInfo;
  buildDivetreeDisplayTree?: (
    args: BuildDivetreeDisplayTreeArgs,
  ) => DivetreeDisplayRootNode | undefined;
};
export const enchancers: {
  [key: string]: Enchancer<Node<any>> | undefined;
} = {
  Identifier: (node: Node<ts.Identifier>, parentPath) => {
    const lastParentEntry = R.last(parentPath);
    const isDeclarationName = lastParentEntry?.childKey === "name";
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [],
        color: isDeclarationName
          ? SemanticColor.DECLARATION_NAME
          : SemanticColor.REFERENCE,
      },
    };
  },
  StringLiteral: (node: Node<ts.StringLiteral>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [
          { text: "string", style: LabelStyle.TYPE_SUMMARY },
          { text: "", style: LabelStyle.VALUE },
        ],
        color: SemanticColor.LITERAL,
      },
    };
  },
  NumericLiteral: (node: Node<ts.NumericLiteral>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [
          { text: "number", style: LabelStyle.TYPE_SUMMARY },
          { text: "", style: LabelStyle.VALUE },
        ],
        color: SemanticColor.LITERAL,
      },
    };
  },
  PropertySignature: (node: Node<ts.PropertySignature>) => {
    const name = tryExtractName(node);
    const label =
      name === undefined
        ? [{ text: "property", style: LabelStyle.TYPE_SUMMARY }]
        : [
            { text: "property", style: LabelStyle.TYPE_SUMMARY },
            { text: name, style: LabelStyle.NAME },
          ];
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  PropertyAssignment: (node: Node<ts.PropertyAssignment>) => {
    const name = tryExtractName(node);
    const label =
      name === undefined
        ? [{ text: "property", style: LabelStyle.TYPE_SUMMARY }]
        : [
            { text: "property", style: LabelStyle.TYPE_SUMMARY },
            { text: name, style: LabelStyle.NAME },
          ];
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  VariableDeclarationList: (node: Node<unknown>) => {
    const flavor = (node.flags as any).variableFlavor?.value;
    const label =
      typeof flavor !== "string"
        ? [{ text: "VariableDeclarationList", style: LabelStyle.UNKNOWN }]
        : [{ text: flavor, style: LabelStyle.TYPE_SUMMARY }];
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  VariableDeclaration: (node: Node<ts.VariableDeclaration>) => {
    const name = tryExtractName(node);
    const label =
      name === undefined
        ? [{ text: "VariableDeclaration", style: LabelStyle.UNKNOWN }]
        : [{ text: name, style: LabelStyle.NAME }];
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  ParameterDeclaration: (node: Node<ts.ParameterDeclaration>) => {
    const name = tryExtractName(node);
    const label =
      name === undefined
        ? [{ text: "parameter", style: LabelStyle.TYPE_SUMMARY }]
        : [
            { text: "parameter", style: LabelStyle.TYPE_SUMMARY },
            { text: name, style: LabelStyle.NAME },
          ];
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  MethodDeclaration: (node: Node<ts.MethodDeclaration>) => {
    const label: LabelPart[] = [
      { text: "method", style: LabelStyle.TYPE_SUMMARY },
    ];
    const name = tryExtractName(node);
    if (name !== undefined) {
      label.push({ text: name, style: LabelStyle.NAME });
    }
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  FunctionDeclaration: (node: Node<ts.FunctionDeclaration>) => {
    const label: LabelPart[] = [
      { text: "function", style: LabelStyle.TYPE_SUMMARY },
    ];
    const name = tryExtractName(node);
    if (name !== undefined) {
      label.push({ text: name, style: LabelStyle.NAME });
    }
    return {
      displayInfo: { priority: DisplayInfoPriority.MEDIUM, label },
      buildDivetreeDisplayTree: ({
        nodeForDisplay,
        buildChildDisplayTree,
      }: BuildDivetreeDisplayTreeArgs): DivetreeDisplayRootNode | undefined => {
        const expectedTightChildKeys = [
          "asteriskToken",
          "name",
          "parameters",
          "typeParameters",
          "type",
        ] as const;
        const expectedAnyChildKeys = ["body"] as const;
        const expectedChildKeys = [
          ...expectedTightChildKeys,
          ...expectedAnyChildKeys,
        ];
        if (
          nodeForDisplay.children.length !== expectedChildKeys.length ||
          !nodeForDisplay.children.every(
            (c, i) => c.key === expectedChildKeys[i],
          )
        ) {
          console.warn("unexpected number or order of children");
          return undefined;
        }

        const tightChildDisplayNodes: {
          [K in typeof expectedTightChildKeys[number]]: TightNode;
        } = {} as any;
        for (const key of expectedTightChildKeys) {
          const child = buildChildDisplayTree(nodeForDisplay.getByPath([key])!);
          if (
            child.kind !== NodeKind.TightLeaf &&
            child.kind !== NodeKind.TightSplit
          ) {
            console.warn("unexpected type of child display node");
            return undefined;
          }
          tightChildDisplayNodes[key] = child;
        }

        const anyChildDisplayNodes: {
          [K in typeof expectedAnyChildKeys[number]]: DivetreeDisplayRootNode;
        } = {} as any;
        for (const key of expectedAnyChildKeys) {
          const child = buildChildDisplayTree(nodeForDisplay.getByPath([key])!);
          anyChildDisplayNodes[key] = child;
        }

        return {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: [
            {
              kind: NodeKind.TightSplit,
              split: Split.SideBySide,
              children: [
                {
                  kind: NodeKind.TightLeaf,
                  id: nodeForDisplay.id,
                  size: [150, 56],
                },
                tightChildDisplayNodes.typeParameters,
                tightChildDisplayNodes.asteriskToken,
                tightChildDisplayNodes.name,
                tightChildDisplayNodes.parameters,
                tightChildDisplayNodes.type,
              ],
            },
            {
              kind: NodeKind.Portal,
              id: `${nodeForDisplay.id}-portal`,
              child: anyChildDisplayNodes.body,
            },
          ],
        };
      },
    };
  },
  FunctionExpression: (node: Node<ts.FunctionExpression>) => {
    const label: LabelPart[] = [
      { text: "function", style: LabelStyle.TYPE_SUMMARY },
    ];
    const name = tryExtractName(node);
    if (name !== undefined) {
      label.push({ text: name, style: LabelStyle.NAME });
    }
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
  PropertyDeclaration: (node: Node<ts.PropertyDeclaration>) => {
    const label: LabelPart[] = [
      { text: "property", style: LabelStyle.TYPE_SUMMARY },
    ];
    const name = tryExtractName(node);
    if (name !== undefined) {
      label.push({ text: name, style: LabelStyle.NAME });
    }
    return { displayInfo: { priority: DisplayInfoPriority.MEDIUM, label } };
  },
};
[
  ["ReturnStatement", "return"],
  ["ImportDeclaration", "import"],
  ["TypeQueryNode", "typeof"],
  ["ArrayLiteralExpression", "array"],
  ["ObjectLiteralExpression", "object"],
  ["CallExpression", "call"],
  ["AsExpression", "as"],
].forEach(([tsType, displayType]) => {
  enchancers[tsType] = (node: Node<unknown>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: displayType, style: LabelStyle.TYPE_SUMMARY }],
      },
    };
  };
});
export function makeUnionMemberEnchancer(
  unionMemberKey: string,
): Enchancer<Node<ts.Node>> {
  const typeString = noCase(unionMemberKey.replace(/Declaration$/, ""));
  return (node: Node<unknown>) => {
    const label: LabelPart[] = [
      { text: typeString, style: LabelStyle.TYPE_SUMMARY },
    ];
    const debugLabel = node.getDebugLabel();
    if (debugLabel) {
      label.push({ text: debugLabel, style: LabelStyle.UNKNOWN });
    }
    const name = tryExtractName(node);
    if (name !== undefined) {
      label.push({ text: name, style: LabelStyle.NAME });
    }
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label,
        color: SemanticColor.DECLARATION,
      },
    };
  };
}
