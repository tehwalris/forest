import { noCase } from "change-case";
import {
  NodeKind,
  PortalNode,
  RootNode as DivetreeDisplayRootNode,
  Node as DivetreeDisplayNode,
  Split,
  TightNode,
  TightLeafNode,
} from "divetree-core";
import * as R from "ramda";
import * as ts from "typescript";
import { ParentPathElement } from "../../parent-index";
import {
  BuildDivetreeDisplayTreeArgs,
  DisplayInfo,
  DisplayInfoPriority,
  LabelPart,
  LabelStyle,
  Node,
  SemanticColor,
} from "../../tree/node";
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
export function filterTruthyChildren<T extends DivetreeDisplayNode>(
  children: (T | boolean | undefined)[],
): T[] {
  return children.filter((c) => c && c !== true).map((c) => c as T);
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
      buildDivetreeDisplayTree: ({
        nodeForDisplay,
        updatePostLayoutHints,
      }: BuildDivetreeDisplayTreeArgs): DivetreeDisplayRootNode | undefined => {
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
        }));
        return {
          kind: NodeKind.TightLeaf,
          id: nodeForDisplay.id,
          size: [150, 22],
        };
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
        updatePostLayoutHints,
        expand,
        showChildNavigationHints,
        focusPath,
      }: BuildDivetreeDisplayTreeArgs): DivetreeDisplayRootNode | undefined => {
        if (!expand) {
          return {
            kind: NodeKind.TightLeaf,
            id: nodeForDisplay.id,
            size: [150, 56],
          };
        }

        const expectedChildKeys = [
          "asteriskToken",
          "name",
          "parameters",
          "typeParameters",
          "type",
          "body",
        ] as const;
        if (
          nodeForDisplay.children.length !== expectedChildKeys.length ||
          !nodeForDisplay.children.every(
            (c, i) => c.key === expectedChildKeys[i],
          )
        ) {
          console.warn("unexpected number or order of children");
          return undefined;
        }

        const childDisplayNodes: {
          [K in typeof expectedChildKeys[number]]: DivetreeDisplayRootNode;
        } = {} as any;
        const childIsEmpty: {
          [K in typeof expectedChildKeys[number]]: boolean;
        } = {} as any;
        for (const key of expectedChildKeys) {
          const child = nodeForDisplay.getByPath([key])!;
          childDisplayNodes[key] = buildChildDisplayTree(child);
          childIsEmpty[key] = child.getDebugLabel() === "Option<None>"; // HACK
        }

        const shouldHideChild = (
          childKey: typeof expectedChildKeys[number],
        ): boolean =>
          !showChildNavigationHints &&
          childIsEmpty[childKey] &&
          (focusPath.length < 2 ||
            !(
              focusPath[0] === nodeForDisplay.id &&
              focusPath[1] === nodeForDisplay.getByPath([childKey])!.id
            ));

        const maybeWrapPortal = (
          node: DivetreeDisplayRootNode,
        ): TightNode | PortalNode =>
          node.kind === NodeKind.TightLeaf || node.kind === NodeKind.TightSplit
            ? node
            : { kind: NodeKind.Portal, id: `${node.id}-portal`, child: node };

        let nextTextNodeIndex = 0;
        const newTextNode = (
          width: number,
          labelText: string,
          labelStyle: LabelStyle,
        ): TightLeafNode => {
          const id = `${nodeForDisplay.id}-extra-text-node-${nextTextNodeIndex}`;
          nextTextNodeIndex++;
          updatePostLayoutHints(id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [{ text: labelText, style: labelStyle }],
          }));
          return {
            kind: NodeKind.TightLeaf,
            id,
            size: [width, 22],
          };
        };

        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
          label: [{ text: "function", style: LabelStyle.KEYWORD }],
        }));

        return {
          kind: NodeKind.TightSplit,
          split: Split.Stacked,
          children: [
            {
              kind: NodeKind.TightSplit,
              split: Split.SideBySide,
              children: filterTruthyChildren([
                {
                  kind: NodeKind.TightLeaf,
                  id: nodeForDisplay.id,
                  size: [72, 56],
                },
                !shouldHideChild("typeParameters") &&
                  maybeWrapPortal(childDisplayNodes.typeParameters),
                !shouldHideChild("asteriskToken") &&
                  maybeWrapPortal(childDisplayNodes.asteriskToken),
                maybeWrapPortal(childDisplayNodes.name),
                newTextNode(10, "(", LabelStyle.SYNTAX_SYMBOL),
                maybeWrapPortal(childDisplayNodes.parameters),
                newTextNode(10, ")", LabelStyle.SYNTAX_SYMBOL),
                !shouldHideChild("type") &&
                  maybeWrapPortal(childDisplayNodes.type),
              ]),
            },
            newTextNode(10, "{", LabelStyle.SYNTAX_SYMBOL),
            {
              kind: NodeKind.Portal,
              id: `${nodeForDisplay.id}-portal`,
              child: childDisplayNodes.body,
            },
            newTextNode(10, "}", LabelStyle.SYNTAX_SYMBOL),
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
