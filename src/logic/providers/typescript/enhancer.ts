import { noCase } from "change-case";
import {
  NodeKind,
  PortalNode,
  RootNode as DivetreeDisplayRootNode,
  Node as DivetreeDisplayNode,
  Split,
  TightNode,
  TightLeafNode,
  TightSplitNode,
} from "divetree-core";
import * as R from "ramda";
import * as ts from "typescript";
import { PostLayoutHints } from "../../layout-hints";
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
export type Enhancer<T extends Node<ts.Node> | Node<ts.NodeArray<ts.Node>>> = (
  node: T,
  parentPath: ParentPathElement[],
) => {
  displayInfo: DisplayInfo;
  buildDivetreeDisplayTree?: (
    args: BuildDivetreeDisplayTreeArgs,
  ) => DivetreeDisplayRootNode | undefined;
};
interface ExtendedDisplayTreeArgsBase extends BuildDivetreeDisplayTreeArgs {
  maybeWrapPortal: (node: DivetreeDisplayRootNode) => TightNode | PortalNode;
  newTextNode: (
    width: number,
    labelText: string,
    labelStyle: LabelStyle,
  ) => TightLeafNode;
}
interface ExtendedDisplayTreeArgsStruct<CK extends string>
  extends ExtendedDisplayTreeArgsBase {
  childDisplayNodes: { [K in CK]: DivetreeDisplayRootNode };
  childIsEmpty: { [K in CK]: boolean };
  childPostLayoutHints: { [K in CK]: PostLayoutHints };
  shouldHideChild: (childKey: CK) => boolean;
}
interface ExtendedDisplayTreeArgsList extends ExtendedDisplayTreeArgsBase {
  childDisplayNodes: DivetreeDisplayRootNode[];
  childIsEmpty: boolean[];
  childPostLayoutHints: PostLayoutHints[];
  shouldHideChild: (childKey: number) => boolean;
}
function withExtendedArgsStruct<CK extends string>(
  expectedChildKeys: CK[],
  innerBuild: (
    args: ExtendedDisplayTreeArgsStruct<CK>,
  ) => DivetreeDisplayRootNode | undefined,
): (args: BuildDivetreeDisplayTreeArgs) => DivetreeDisplayRootNode | undefined {
  return (args: BuildDivetreeDisplayTreeArgs) => {
    const {
      nodeForDisplay,
      buildChildDisplayTree,
      showChildNavigationHints,
      focusPath,
      getPostLayoutHints,
      updatePostLayoutHints,
    } = args;

    if (
      nodeForDisplay.children.length !== expectedChildKeys.length ||
      !nodeForDisplay.children.every((c, i) => c.key === expectedChildKeys[i])
    ) {
      console.warn("unexpected number or order of children");
      return undefined;
    }

    const childDisplayNodes: {
      [K in CK]: DivetreeDisplayRootNode;
    } = {} as any;
    const childIsEmpty: {
      [K in CK]: boolean;
    } = {} as any;
    const childPostLayoutHints: {
      [K in CK]: PostLayoutHints;
    } = {} as any;
    for (const key of expectedChildKeys) {
      const child = nodeForDisplay.getByPath([key])!;
      childDisplayNodes[key] = buildChildDisplayTree(child);
      childIsEmpty[key] = child.getDebugLabel() === "Option<None>"; // HACK
      childPostLayoutHints[key] = getPostLayoutHints(child.id);
    }

    const shouldHideChild = (childKey: CK): boolean =>
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

    return innerBuild({
      ...args,
      childDisplayNodes,
      childIsEmpty,
      childPostLayoutHints,
      shouldHideChild,
      maybeWrapPortal,
      newTextNode,
    });
  };
}
function withExtendedArgsList(
  innerBuild: (
    args: ExtendedDisplayTreeArgsList,
  ) => DivetreeDisplayRootNode | undefined,
): (args: BuildDivetreeDisplayTreeArgs) => DivetreeDisplayRootNode | undefined {
  return (originalArgs: BuildDivetreeDisplayTreeArgs) => {
    const { nodeForDisplay } = originalArgs;
    const childKeys = nodeForDisplay.children.map((c) => c.key);
    return withExtendedArgsStruct(childKeys, (structArgs) => {
      return innerBuild({
        ...structArgs,
        childDisplayNodes: childKeys.map(
          (k) => structArgs.childDisplayNodes[k],
        ),
        childIsEmpty: childKeys.map((k) => structArgs.childIsEmpty[k]),
        childPostLayoutHints: childKeys.map(
          (k) => structArgs.childPostLayoutHints[k],
        ),
        shouldHideChild: (i) => structArgs.shouldHideChild(childKeys[i]),
      });
    })(originalArgs);
  };
}
export const enhancers: {
  [key: string]: Enhancer<any> | undefined;
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
          { text: '"', style: LabelStyle.SYNTAX_SYMBOL },
          { text: "", style: LabelStyle.VALUE },
          { text: '"', style: LabelStyle.SYNTAX_SYMBOL },
        ],
        color: SemanticColor.LITERAL,
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
    return {
      displayInfo: { priority: DisplayInfoPriority.MEDIUM, label },
      buildDivetreeDisplayTree: withExtendedArgsStruct(
        ["dotDotDotToken", "name", "questionToken", "type", "initializer"],
        ({
          nodeForDisplay,
          updatePostLayoutHints,
          expand,
          shouldHideChild,
          maybeWrapPortal,
          childDisplayNodes,
          showChildNavigationHints,
        }) => {
          if (!expand) {
            return {
              kind: NodeKind.TightLeaf,
              id: nodeForDisplay.id,
              size: [150, 56],
            };
          }

          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [],
          }));

          return {
            kind: NodeKind.TightSplit,
            split: Split.SideBySide,
            growLast: true,
            children: filterTruthyChildren([
              showChildNavigationHints && {
                kind: NodeKind.TightLeaf,
                id: nodeForDisplay.id,
                size: [10, 22],
              },
              {
                kind: NodeKind.TightSplit,
                split: showChildNavigationHints
                  ? Split.Stacked
                  : Split.SideBySide,
                growLast: true,
                children: filterTruthyChildren([
                  !shouldHideChild("dotDotDotToken") &&
                    maybeWrapPortal(childDisplayNodes.dotDotDotToken),
                  maybeWrapPortal(childDisplayNodes.name),
                  !shouldHideChild("questionToken") &&
                    maybeWrapPortal(childDisplayNodes.questionToken),
                  !shouldHideChild("type") &&
                    maybeWrapPortal(childDisplayNodes.type),
                  !shouldHideChild("initializer") &&
                    maybeWrapPortal(childDisplayNodes.initializer),
                ]),
              },
            ]),
          };
        },
      ),
    };
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
      buildDivetreeDisplayTree: withExtendedArgsStruct(
        [
          "asteriskToken",
          "name",
          "parameters",
          "typeParameters",
          "type",
          "body",
        ],
        ({
          nodeForDisplay,
          updatePostLayoutHints,
          expand,
          shouldHideChild,
          maybeWrapPortal,
          childDisplayNodes,
          childPostLayoutHints,
          newTextNode,
        }): DivetreeDisplayRootNode | undefined => {
          if (!expand) {
            return {
              kind: NodeKind.TightLeaf,
              id: nodeForDisplay.id,
              size: [150, 22],
            };
          }

          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [{ text: "function", style: LabelStyle.KEYWORD }],
          }));

          const expandParameters = !!childPostLayoutHints.parameters.didBreak;

          const closingParen = newTextNode(10, ")", LabelStyle.SYNTAX_SYMBOL);

          return {
            kind: NodeKind.TightSplit,
            split: Split.Stacked,
            growLast: true,
            children: filterTruthyChildren([
              {
                kind: NodeKind.TightSplit,
                split: Split.SideBySide,
                growLast: true,
                children: filterTruthyChildren([
                  {
                    kind: NodeKind.TightLeaf,
                    id: nodeForDisplay.id,
                    size: [72, 22],
                  },
                  !shouldHideChild("typeParameters") &&
                    maybeWrapPortal(childDisplayNodes.typeParameters),
                  !shouldHideChild("asteriskToken") &&
                    maybeWrapPortal(childDisplayNodes.asteriskToken),
                  maybeWrapPortal(childDisplayNodes.name),
                  newTextNode(10, "(", LabelStyle.SYNTAX_SYMBOL),
                  !expandParameters &&
                    maybeWrapPortal(childDisplayNodes.parameters),
                  !expandParameters && closingParen,
                  !expandParameters &&
                    !shouldHideChild("type") &&
                    maybeWrapPortal(childDisplayNodes.type),
                ]),
              },
              expandParameters && maybeWrapPortal(childDisplayNodes.parameters),
              {
                kind: NodeKind.TightSplit,
                split: Split.SideBySide,
                growLast: true,
                children: filterTruthyChildren([
                  expandParameters && closingParen,
                  newTextNode(10, "{", LabelStyle.SYNTAX_SYMBOL),
                ]),
              },
              {
                kind: NodeKind.Portal,
                id: `${nodeForDisplay.id}-portal`,
                child: childDisplayNodes.body,
              },
              newTextNode(10, "}", LabelStyle.SYNTAX_SYMBOL),
            ]),
          };
        },
      ),
    };
  },
  "FunctionDeclaration.parameters": (
    node: Node<ts.NodeArray<ts.ParameterDeclaration>>,
  ) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.LOW,
        label: [],
      },
      buildDivetreeDisplayTree: withExtendedArgsList(
        ({
          nodeForDisplay,
          childDisplayNodes,
          maybeWrapPortal,
          newTextNode,
          updatePostLayoutHints,
          showChildNavigationHints,
        }) => {
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            didBreak: !!childDisplayNodes.length,
          }));

          if (!childDisplayNodes.length) {
            return {
              kind: NodeKind.TightLeaf,
              id: nodeForDisplay.id,
              size: [10, 22],
            };
          }

          const childrenWithCommas: TightSplitNode[] = childDisplayNodes.map(
            (c) => ({
              kind: NodeKind.TightSplit,
              split: Split.SideBySide,
              growLast: true,
              children: [
                maybeWrapPortal(c),
                newTextNode(10, ",", LabelStyle.SYNTAX_SYMBOL),
              ],
            }),
          );

          if (showChildNavigationHints) {
            return {
              kind: NodeKind.Loose,
              id: `${nodeForDisplay.id}-loose`,
              parent: {
                kind: NodeKind.TightLeaf,
                id: nodeForDisplay.id,
                size: [10, 22],
              },
              children: childrenWithCommas,
            };
          }

          return {
            kind: NodeKind.TightSplit,
            split: Split.SideBySide,
            growLast: true,
            children: [
              {
                kind: NodeKind.TightLeaf,
                id: nodeForDisplay.id,
                size: [10, 22],
              },
              {
                kind: NodeKind.TightSplit,
                split: Split.Stacked,
                growLast: true,
                children: childrenWithCommas,
              },
            ],
          };
        },
      ),
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
  enhancers[tsType] = (node: Node<unknown>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: displayType, style: LabelStyle.TYPE_SUMMARY }],
      },
    };
  };
});
export function makeUnionMemberEnhancer(
  unionMemberKey: string,
): Enhancer<Node<ts.Node>> {
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
