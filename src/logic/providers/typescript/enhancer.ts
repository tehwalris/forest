import { noCase } from "change-case";
import {
  NodeKind,
  PortalNode,
  RootNode as DivetreeDisplayRootNode,
  TightLeafNode,
  TightNode,
} from "divetree-core";
import * as R from "ramda";
import * as ts from "typescript";
import { ParentPathElement } from "../../parent-index";
import { arrayFromTextSize } from "../../text-measurement";
import {
  Doc,
  groupDoc,
  leafDoc,
  lineDoc,
  LineKind,
  nestDoc,
} from "../../tree/display-line";
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
export function filterTruthyChildren<T extends Object>(
  children: (T | boolean | undefined)[],
): T[] {
  return children.filter((c) => c && c !== true).map((c) => c as T);
}
export type Enhancer<T extends Node<ts.Node> | Node<ts.NodeArray<ts.Node>>> = (
  node: T,
  parentPath: ParentPathElement[],
) => {
  displayInfo: DisplayInfo;
  buildDoc?: (args: BuildDivetreeDisplayTreeArgs) => Doc | undefined;
};
interface ExtendedDisplayTreeArgsBase extends BuildDivetreeDisplayTreeArgs {
  maybeWrapPortal: (node: DivetreeDisplayRootNode) => TightNode | PortalNode;
  newTextNode: (
    labelText: string,
    labelStyle: LabelStyle,
    idSuffix?: string,
  ) => TightLeafNode;
  newFocusMarker: () => Doc;
}
interface ExtendedDisplayTreeArgsStruct<CK extends string>
  extends ExtendedDisplayTreeArgsBase {
  childDocs: {
    [K in CK]: Doc;
  };
  childDisplayNodes: {
    [K in CK]: DivetreeDisplayRootNode;
  };
  childIsEmpty: {
    [K in CK]: boolean;
  };
  shouldHideChild: (childKey: CK) => boolean;
}
interface ExtendedDisplayTreeArgsList extends ExtendedDisplayTreeArgsBase {
  childDocs: Doc[];
  childDisplayNodes: DivetreeDisplayRootNode[];
  childIsEmpty: boolean[];
  shouldHideChild: (childKey: number) => boolean;
}
export function withExtendedArgsStruct<CK extends string, R>(
  expectedChildKeys: CK[],
  innerBuild: (args: ExtendedDisplayTreeArgsStruct<CK>) => R | undefined,
): (args: BuildDivetreeDisplayTreeArgs) => R | undefined {
  return (args: BuildDivetreeDisplayTreeArgs) => {
    const {
      nodeForDisplay,
      buildChildDoc,
      showChildNavigationHints,
      focusPath,
      updatePostLayoutHints,
      measureLabel,
    } = args;
    if (
      nodeForDisplay.children.length !== expectedChildKeys.length ||
      !nodeForDisplay.children.every((c, i) => c.key === expectedChildKeys[i])
    ) {
      console.warn("unexpected number or order of children");
      return undefined;
    }
    const childDocs: {
      [K in CK]: Doc;
    } = {} as any;
    const childDisplayNodes: {
      [K in CK]: DivetreeDisplayRootNode;
    } = {} as any;
    const childIsEmpty: {
      [K in CK]: boolean;
    } = {} as any;
    for (const key of expectedChildKeys) {
      const child = nodeForDisplay.getByPath([key])!;
      childDocs[key] = buildChildDoc(child);
      childIsEmpty[key] = child.getDebugLabel() === "Option<None>";
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
      labelText: string,
      labelStyle: LabelStyle,
      idSuffix?: string,
    ): TightLeafNode => {
      if (!idSuffix) {
        idSuffix = `extra-text-node-${nextTextNodeIndex}`;
        nextTextNodeIndex++;
      }
      const id = `${nodeForDisplay.id}-${idSuffix}`;
      const label: LabelPart[] = [{ text: labelText, style: labelStyle }];
      updatePostLayoutHints(id, (oldHints) => ({
        ...oldHints,
        styleAsText: true,
        label,
      }));
      return {
        kind: NodeKind.TightLeaf,
        id,
        size: arrayFromTextSize(measureLabel(label)),
      };
    };
    let focusMarkerCreated = false;
    const newFocusMarker = () => {
      if (focusMarkerCreated) {
        throw new Error("newFocusMarker can only be called once");
      }
      focusMarkerCreated = true;
      updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
        ...oldHints,
        hideFocus: true,
        label: [],
      }));
      return leafDoc(
        { kind: NodeKind.TightLeaf, id: nodeForDisplay.id, size: [0, 0] },
        true,
      );
    };
    return innerBuild({
      ...args,
      childDocs,
      childDisplayNodes,
      childIsEmpty,
      shouldHideChild,
      maybeWrapPortal,
      newTextNode,
      newFocusMarker,
    });
  };
}
export function withExtendedArgsList<R>(
  innerBuild: (args: ExtendedDisplayTreeArgsList) => R | undefined,
): (args: BuildDivetreeDisplayTreeArgs) => R | undefined {
  return (originalArgs: BuildDivetreeDisplayTreeArgs) => {
    const { nodeForDisplay } = originalArgs;
    const childKeys = nodeForDisplay.children.map((c) => c.key);
    return withExtendedArgsStruct(childKeys, (structArgs) => {
      return innerBuild({
        ...structArgs,
        childDocs: childKeys.map((k) => structArgs.childDocs[k]),
        childDisplayNodes: childKeys.map(
          (k) => structArgs.childDisplayNodes[k],
        ),
        childIsEmpty: childKeys.map((k) => structArgs.childIsEmpty[k]),
        shouldHideChild: (i) => structArgs.shouldHideChild(childKeys[i]),
      });
    })(originalArgs);
  };
}
function makeWrappedListEnhancer(
  typeName: string | undefined,
  left: string | undefined,
  separator: string,
  right: string | undefined,
): Enhancer<Node<ts.NodeArray<ts.Node>>> {
  return () => ({
    displayInfo: {
      priority: DisplayInfoPriority.MEDIUM,
      label:
        typeName === undefined
          ? []
          : [{ text: typeName, style: LabelStyle.UNKNOWN }],
    },
    buildDoc: withExtendedArgsList(
      ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
        const focusMarker = newFocusMarker();
        return groupDoc(
          filterTruthyChildren([
            !childDocs.length && focusMarker,
            !!left && leafDoc(newTextNode(left, LabelStyle.SYNTAX_SYMBOL)),
            groupDoc([
              nestDoc(
                1,
                childDocs.map((c, i) => [
                  i === 0 ? [lineDoc(LineKind.Soft), focusMarker] : lineDoc(),
                  c,
                  leafDoc(newTextNode(separator, LabelStyle.SYNTAX_SYMBOL)),
                ]),
              ),
              lineDoc(LineKind.Soft),
            ]),
            !!right && leafDoc(newTextNode(right, LabelStyle.SYNTAX_SYMBOL)),
          ]),
        );
      },
    ),
  });
}
const commaListEnhancer = makeWrappedListEnhancer(
  undefined,
  undefined,
  ",",
  undefined,
);
const onePerLineEnhancer: Enhancer<Node<ts.NodeArray<ts.Node>>> = () => ({
  displayInfo: {
    priority: DisplayInfoPriority.LOW,
    label: [],
  },
  buildDoc: withExtendedArgsList(
    ({ childDocs, newFocusMarker }): Doc | undefined => {
      return groupDoc([
        newFocusMarker(),
        childDocs.map((c, i) => (i === 0 ? c : [lineDoc(LineKind.Hard), c])),
      ]);
    },
  ),
});
const makeFunctionOrMethodEnhancer = (
  typeName: string,
  keyword: string | undefined,
  childKeys: (
    | "asteriskToken"
    | "name"
    | "questionToken"
    | "parameters"
    | "typeParameters"
    | "type"
    | "body"
  )[],
): Enhancer<Node<ts.Node>> => {
  return () => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: typeName, style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        childKeys,
        ({
          shouldHideChild,
          showChildNavigationHints,
          childDocs,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const typeWithColon: Doc = groupDoc([
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.type,
          ]);
          const typeParametersWithArrows: Doc = groupDoc([
            leafDoc(newTextNode("<", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.typeParameters,
            leafDoc(newTextNode(">", LabelStyle.SYNTAX_SYMBOL)),
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !!keyword &&
                leafDoc(newTextNode(keyword + " ", LabelStyle.KEYWORD)),
              !shouldHideChild("asteriskToken") && childDocs.asteriskToken,
              childDocs.name,
              !shouldHideChild("questionToken") && childDocs.questionToken,
              !shouldHideChild("typeParameters") && typeParametersWithArrows,
              leafDoc(newTextNode("(", LabelStyle.SYNTAX_SYMBOL)),
              groupDoc([
                nestDoc(
                  1,
                  groupDoc([lineDoc(LineKind.Soft), childDocs.parameters]),
                ),
                lineDoc(LineKind.Soft),
              ]),
              leafDoc(newTextNode(")", LabelStyle.SYNTAX_SYMBOL)),
              !shouldHideChild("type") && typeWithColon,
              leafDoc(newTextNode(" ", LabelStyle.SYNTAX_SYMBOL)),
              !shouldHideChild("body") && childDocs.body,
            ]),
          );
        },
      ),
    };
  };
};
const makeReturnLikeEnhancer = (keyword: string) => () => {
  const label = [{ text: keyword, style: LabelStyle.SYNTAX_SYMBOL }];
  return {
    displayInfo: { priority: DisplayInfoPriority.MEDIUM, label },
    buildDoc: withExtendedArgsStruct(
      ["expression"],
      ({
        nodeForDisplay,
        childDocs,
        showChildNavigationHints,
        updatePostLayoutHints,
        newTextNode,
        measureLabel,
      }) => {
        if (showChildNavigationHints) {
          return undefined;
        }
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
        }));
        return groupDoc([
          leafDoc({
            kind: NodeKind.TightLeaf,
            id: nodeForDisplay.id,
            size: arrayFromTextSize(measureLabel(label)),
          }),
          leafDoc(newTextNode(" ", LabelStyle.WHITESPACE)),
          nestDoc(1, childDocs.expression),
        ]);
      },
    ),
  };
};
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
      buildDoc: ({
        nodeForDisplay,
        updatePostLayoutHints,
        measureLabel,
      }: BuildDivetreeDisplayTreeArgs): Doc | undefined => {
        const label: LabelPart[] = [
          { text: node.getDebugLabel() || "", style: LabelStyle.VALUE },
        ];
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
          label,
        }));
        return leafDoc({
          kind: NodeKind.TightLeaf,
          id: nodeForDisplay.id,
          size: arrayFromTextSize(measureLabel(label)),
        });
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
      buildDoc: ({
        nodeForDisplay,
        updatePostLayoutHints,
        measureLabel,
      }: BuildDivetreeDisplayTreeArgs): Doc | undefined => {
        const label: LabelPart[] = [
          { text: '"', style: LabelStyle.SYNTAX_SYMBOL },
          { text: node.getDebugLabel() || "", style: LabelStyle.VALUE },
          { text: '"', style: LabelStyle.SYNTAX_SYMBOL },
        ];
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
          label,
        }));
        return leafDoc({
          kind: NodeKind.TightLeaf,
          id: nodeForDisplay.id,
          size: arrayFromTextSize(measureLabel(label)),
        });
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
      buildDoc: ({
        nodeForDisplay,
        updatePostLayoutHints,
        measureLabel,
      }: BuildDivetreeDisplayTreeArgs): Doc | undefined => {
        const label: LabelPart[] = [
          { text: node.getDebugLabel() || "number", style: LabelStyle.VALUE },
        ];
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
          label,
        }));
        return leafDoc({
          kind: NodeKind.TightLeaf,
          id: nodeForDisplay.id,
          size: arrayFromTextSize(measureLabel(label)),
        });
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
    return {
      displayInfo: { priority: DisplayInfoPriority.MEDIUM, label },
      buildDoc: withExtendedArgsStruct(
        ["name", "type", "initializer"],
        ({
          showChildNavigationHints,
          shouldHideChild,
          childDocs,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const typeWithColon: Doc = groupDoc([
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.type,
          ]);
          const initializerWithEqualsSign: Doc = groupDoc([
            leafDoc(newTextNode(" = ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.initializer,
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.name,
              !shouldHideChild("type") && typeWithColon,
              !shouldHideChild("initializer") && initializerWithEqualsSign,
            ]),
          );
        },
      ),
    };
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
      buildDoc: withExtendedArgsStruct(
        ["dotDotDotToken", "name", "questionToken", "type", "initializer"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const initializerWithEqualsSign = groupDoc([
            leafDoc(newTextNode(" = ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.initializer,
          ]);
          const typeWithColon: Doc = groupDoc([
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.type,
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("dotDotDotToken") && childDocs.dotDotDotToken,
              childDocs.name,
              !shouldHideChild("questionToken") && childDocs.questionToken,
              !shouldHideChild("type") && typeWithColon,
              !shouldHideChild("initializer") && initializerWithEqualsSign,
            ]),
          );
        },
      ),
    };
  },
  FunctionDeclaration: makeFunctionOrMethodEnhancer(
    "FunctionDeclaration",
    "function",
    ["asteriskToken", "name", "parameters", "typeParameters", "type", "body"],
  ),
  "FunctionDeclaration.parameters": commaListEnhancer,
  "FunctionDeclaration.typeParameters": commaListEnhancer,
  ArrowFunction: (node: Node<ts.ArrowFunction>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ArrowFunction", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["typeParameters", "parameters", "type", "body"],
        ({
          shouldHideChild,
          showChildNavigationHints,
          childDocs,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const typeWithColon: Doc = groupDoc([
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.type,
          ]);
          const typeParametersWithArrows: Doc = groupDoc([
            leafDoc(newTextNode("<", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.typeParameters,
            leafDoc(newTextNode(">", LabelStyle.SYNTAX_SYMBOL)),
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("typeParameters") && typeParametersWithArrows,
              leafDoc(newTextNode("(", LabelStyle.SYNTAX_SYMBOL)),
              groupDoc([
                nestDoc(1, [lineDoc(LineKind.Soft), childDocs.parameters]),
                lineDoc(LineKind.Soft),
              ]),
              leafDoc(newTextNode(")", LabelStyle.SYNTAX_SYMBOL)),
              !shouldHideChild("type") && typeWithColon,
              leafDoc(newTextNode(" => ", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.body,
            ]),
          );
        },
      ),
    };
  },
  "ArrowFunction.parameters": commaListEnhancer,
  "ArrowFunction.typeParameters": commaListEnhancer,
  FunctionTypeNode: (node: Node<ts.FunctionTypeNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "FunctionTypeNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["typeParameters", "parameters", "type"],
        ({
          shouldHideChild,
          showChildNavigationHints,
          childDocs,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const typeParametersWithArrows: Doc = groupDoc([
            leafDoc(newTextNode("<", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.typeParameters,
            leafDoc(newTextNode(">", LabelStyle.SYNTAX_SYMBOL)),
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("typeParameters") && typeParametersWithArrows,
              leafDoc(newTextNode("(", LabelStyle.SYNTAX_SYMBOL)),
              groupDoc([
                nestDoc(1, [lineDoc(LineKind.Soft), childDocs.parameters]),
                lineDoc(LineKind.Soft),
              ]),
              leafDoc(newTextNode(") => ", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.type,
            ]),
          );
        },
      ),
    };
  },
  "FunctionTypeNode.parameters": commaListEnhancer,
  "FunctionTypeNode.typeParameters": commaListEnhancer,
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
  ClassDeclaration: (node: Node<ts.ClassDeclaration>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ClassDeclaration", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "typeParameters", "heritageClauses", "members"],
        ({
          shouldHideChild,
          showChildNavigationHints,
          childDocs,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const nameWithSpace: Doc = [
            leafDoc(newTextNode(" ", LabelStyle.WHITESPACE)),
            childDocs.name,
          ];
          const typeParametersWithArrows: Doc = [
            leafDoc(newTextNode("<", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.typeParameters,
            leafDoc(newTextNode(">", LabelStyle.SYNTAX_SYMBOL)),
          ];
          const heritageClausesWithSpace: Doc = [
            leafDoc(newTextNode(" ", LabelStyle.WHITESPACE)),
            childDocs.heritageClauses,
          ];
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(newTextNode("class", LabelStyle.SYNTAX_SYMBOL)),
              !shouldHideChild("name") && nameWithSpace,
              !shouldHideChild("typeParameters") && typeParametersWithArrows,
              !shouldHideChild("heritageClauses") && heritageClausesWithSpace,
              leafDoc(newTextNode(" ", LabelStyle.WHITESPACE)),
              leafDoc(newTextNode("{", LabelStyle.SYNTAX_SYMBOL)),
              nestDoc(1, [lineDoc(LineKind.Hard), childDocs.members]),
              lineDoc(LineKind.Hard),
              leafDoc(newTextNode("}", LabelStyle.SYNTAX_SYMBOL)),
            ]),
          );
        },
      ),
    };
  },
  "ClassDeclaration.typeParameters": commaListEnhancer,
  "ClassDeclaration.members": onePerLineEnhancer,
  PropertyDeclaration: (node: Node<ts.PropertyDeclaration>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "PropertyDeclaration", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "questionToken", "type", "initializer"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const typeWithColon = groupDoc([
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.type,
          ]);
          const initializerWithEqualsSign = groupDoc([
            leafDoc(newTextNode(" = ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.initializer,
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.name,
              !shouldHideChild("questionToken") && childDocs.questionToken,
              !shouldHideChild("type") && typeWithColon,
              !shouldHideChild("initializer") && initializerWithEqualsSign,
            ]),
          );
        },
      ),
    };
  },
  MethodDeclaration: makeFunctionOrMethodEnhancer(
    "MethodDeclaration",
    undefined,
    [
      "asteriskToken",
      "name",
      "questionToken",
      "typeParameters",
      "parameters",
      "type",
      "body",
    ],
  ),
  "MethodDeclaration.parameters": commaListEnhancer,
  "MethodDeclaration.typeParameters": commaListEnhancer,
  PropertyAccessExpression: (node: Node<ts.PropertyAccessExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "property access", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression", "questionDotToken", "name"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const dotToken = newTextNode(".", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.expression,
              shouldHideChild("questionDotToken")
                ? leafDoc(dotToken)
                : childDocs.questionDotToken,
              childDocs.name,
            ]),
          );
        },
      ),
    };
  },
  ElementAccessExpression: (node: Node<ts.ElementAccessExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "element access", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression", "questionDotToken", "argumentExpression"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.expression,
              !shouldHideChild("questionDotToken") &&
                childDocs.questionDotToken,
              leafDoc(newTextNode("[", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.argumentExpression,
              leafDoc(newTextNode("]", LabelStyle.SYNTAX_SYMBOL)),
            ]),
          );
        },
      ),
    };
  },
  CallExpression: (node: Node<ts.CallExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "call", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression", "questionDotToken", "typeArguments", "arguments"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const openingArrow = newTextNode("<", LabelStyle.SYNTAX_SYMBOL);
          const closingArrow = newTextNode(">", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.expression,
              !shouldHideChild("questionDotToken") &&
                childDocs.questionDotToken,
              !shouldHideChild("typeArguments") &&
                groupDoc([
                  leafDoc(openingArrow),
                  childDocs.typeArguments,
                  leafDoc(closingArrow),
                ]),
              leafDoc(newTextNode("(", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.arguments,
              leafDoc(newTextNode(")", LabelStyle.SYNTAX_SYMBOL)),
            ]),
          );
        },
      ),
    };
  },
  "CallExpression.typeArguments": commaListEnhancer,
  "CallExpression.arguments": commaListEnhancer,
  NewExpression: (node: Node<ts.NewExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "new", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression", "typeArguments", "arguments"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const openingArrow = newTextNode("<", LabelStyle.SYNTAX_SYMBOL);
          const closingArrow = newTextNode(">", LabelStyle.SYNTAX_SYMBOL);
          const openingParen = newTextNode("(", LabelStyle.SYNTAX_SYMBOL);
          const closingParen = newTextNode(")", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(newTextNode("new ", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.expression,
              !shouldHideChild("typeArguments") &&
                groupDoc([
                  leafDoc(openingArrow),
                  childDocs.typeArguments,
                  leafDoc(closingArrow),
                ]),
              !shouldHideChild("arguments") && [
                leafDoc(openingParen),
                childDocs.arguments,
                leafDoc(closingParen),
              ],
            ]),
          );
        },
      ),
    };
  },
  "NewExpression.arguments": commaListEnhancer,
  "NewExpression.typeArguments": commaListEnhancer,
  TypeParameterDeclaration: (node: Node<ts.TypeParameterDeclaration>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [
          { text: "TypeParameterDeclaration", style: LabelStyle.UNKNOWN },
        ],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "constraint", "default"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const constraintWithExtends = groupDoc([
            leafDoc(newTextNode(" extends ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.constraint,
          ]);
          const defaultWithEquals = groupDoc([
            leafDoc(newTextNode(" = ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.default,
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.name,
              !shouldHideChild("constraint") && constraintWithExtends,
              !shouldHideChild("default") && defaultWithEquals,
            ]),
          );
        },
      ),
    };
  },
  BinaryExpression: (node: Node<ts.BinaryExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "BinaryExpression", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["left", "operatorToken", "right"],
        ({
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc([
            newFocusMarker(),
            childDocs.left,
            leafDoc(newTextNode(" ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.operatorToken,
            leafDoc(newTextNode(" ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.right,
          ]);
        },
      ),
    };
  },
  ExpressionStatement: (node: Node<ts.ExpressionStatement>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ExpressionStatement", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression"],
        ({
          childDocs,
          showChildNavigationHints,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc([newFocusMarker(), childDocs.expression]);
        },
      ),
    };
  },
  Block: (node: Node<ts.Block>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "block", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsList(
        ({
          childDocs,
          expand,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          const ellipsis = newTextNode("...", LabelStyle.UNKNOWN);
          const focusMarker = newFocusMarker();
          return groupDoc(
            filterTruthyChildren([
              (!expand || !childDocs.length) && focusMarker,
              leafDoc(newTextNode("{", LabelStyle.SYNTAX_SYMBOL)),
              expand
                ? groupDoc([
                    nestDoc(
                      1,
                      childDocs.map((c, i) =>
                        filterTruthyChildren([
                          lineDoc(LineKind.Hard),
                          i === 0 && focusMarker,
                          c,
                        ]),
                      ),
                    ),
                    lineDoc(LineKind.Hard),
                  ])
                : leafDoc(ellipsis),
              leafDoc(newTextNode("}", LabelStyle.SYNTAX_SYMBOL)),
            ]),
          );
        },
      ),
    };
  },
  ArrayLiteralExpression: makeWrappedListEnhancer(
    "ArrayLiteralExpression",
    "[",
    ",",
    "]",
  ),
  ArrayBindingPattern: makeWrappedListEnhancer(
    "ArrayBindingPattern",
    "[",
    ",",
    "]",
  ),
  BindingElement: (node: Node<ts.BindingElement>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "BindingElement", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["propertyName", "dotDotDotToken", "name", "initializer"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const propertyNameWithColon = groupDoc([
            childDocs.propertyName,
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
          ]);
          const initializerWithEqualsSign = groupDoc([
            leafDoc(newTextNode(" = ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.initializer,
          ]);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("dotDotDotToken") && childDocs.dotDotDotToken,
              !shouldHideChild("propertyName") && propertyNameWithColon,
              childDocs.name,
              !shouldHideChild("initializer") && initializerWithEqualsSign,
            ]),
          );
        },
      ),
    };
  },
  ObjectLiteralExpression: makeWrappedListEnhancer(
    "ObjectLiteralExpression",
    "{",
    ",",
    "}",
  ),
  PropertyAssignment: (node: Node<ts.PropertyAssignment>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "property", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "initializer"],
        ({
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc([
            newFocusMarker(),
            childDocs.name,
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.initializer,
          ]);
        },
      ),
    };
  },
  ShorthandPropertyAssignment: (node: Node<ts.ShorthandPropertyAssignment>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "shorthand property", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "objectAssignmentInitializer"],
        ({
          childDocs,
          showChildNavigationHints,
          shouldHideChild,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const initializerWithColon: Doc = [
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.objectAssignmentInitializer,
          ];
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.name,
              !shouldHideChild("objectAssignmentInitializer") &&
                initializerWithColon,
            ]),
          );
        },
      ),
    };
  },
  SpreadAssignment: (node: Node<ts.SpreadAssignment>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "spread", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression"],
        ({
          nodeForDisplay,
          childDocs,
          showChildNavigationHints,
          updatePostLayoutHints,
          measureLabel,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const label = [{ text: "...", style: LabelStyle.SYNTAX_SYMBOL }];
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label,
          }));
          return groupDoc([
            leafDoc({
              kind: NodeKind.TightLeaf,
              id: nodeForDisplay.id,
              size: arrayFromTextSize(measureLabel(label)),
            }),
            childDocs.expression,
          ]);
        },
      ),
    };
  },
  ObjectBindingPattern: makeWrappedListEnhancer(
    "ObjectBindingPattern",
    "{",
    ",",
    "}",
  ),
  ReturnStatement: makeReturnLikeEnhancer("return"),
  ThrowStatement: makeReturnLikeEnhancer("throw"),
  PrefixUnaryExpression: (node: Node<ts.PrefixUnaryExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "PrefixUnaryExpression", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["operator", "operand"],
        ({ childDocs, showChildNavigationHints }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc([childDocs.operator, childDocs.operand]);
        },
      ),
    };
  },
  PostfixUnaryExpression: (node: Node<ts.PostfixUnaryExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "PostfixUnaryExpression", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["operand", "operator"],
        ({ childDocs, showChildNavigationHints }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc([childDocs.operand, childDocs.operator]);
        },
      ),
    };
  },
  TypeReferenceNode: (node: Node<ts.TypeReferenceNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "TypeReferenceNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["typeName", "typeArguments"],
        ({
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const openingArrow = newTextNode("<", LabelStyle.SYNTAX_SYMBOL);
          const closingArrow = newTextNode(">", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              childDocs.typeName,
              !shouldHideChild("typeArguments") &&
                groupDoc([
                  leafDoc(openingArrow),
                  childDocs.typeArguments,
                  leafDoc(closingArrow),
                ]),
            ]),
          );
        },
      ),
    };
  },
  "TypeReferenceNode.typeArguments": commaListEnhancer,
  ArrayTypeNode: (node: Node<ts.ArrayTypeNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "array", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["elementType"],
        ({
          nodeForDisplay,
          childDocs,
          showChildNavigationHints,
          updatePostLayoutHints,
          measureLabel,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          const label: LabelPart[] = [
            { text: "[]", style: LabelStyle.SYNTAX_SYMBOL },
          ];
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label,
          }));
          return groupDoc([
            childDocs.elementType,
            leafDoc({
              kind: NodeKind.TightLeaf,
              id: nodeForDisplay.id,
              size: arrayFromTextSize(measureLabel(label)),
            }),
          ]);
        },
      ),
    };
  },
  UnionTypeNode: (node: Node<ts.UnionTypeNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "UnionTypeNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsList(
        ({
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc(
            filterTruthyChildren([
              !childDocs.length && newFocusMarker(),
              nestDoc(1, [
                lineDoc(LineKind.Soft),
                childDocs.map((c, i) =>
                  i === 0
                    ? [newFocusMarker(), c]
                    : [
                        leafDoc(newTextNode(" |", LabelStyle.SYNTAX_SYMBOL)),
                        lineDoc(),
                        c,
                      ],
                ),
              ]),
              lineDoc(LineKind.Soft),
            ]),
          );
        },
      ),
    };
  },
  IntersectionTypeNode: (node: Node<ts.IntersectionTypeNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "IntersectionTypeNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsList(
        ({
          childDocs,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          return groupDoc(
            filterTruthyChildren([
              !childDocs.length && newFocusMarker(),
              nestDoc(1, [
                lineDoc(LineKind.Soft),
                childDocs.map((c, i) =>
                  i === 0
                    ? [newFocusMarker(), c]
                    : [
                        leafDoc(newTextNode(" &", LabelStyle.SYNTAX_SYMBOL)),
                        lineDoc(),
                        c,
                      ],
                ),
              ]),
              lineDoc(LineKind.Soft),
            ]),
          );
        },
      ),
    };
  },
  QualifiedName: (node: Node<ts.QualifiedName>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "QualifiedName", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["left", "right"],
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          return groupDoc([
            newFocusMarker(),
            childDocs.left,
            leafDoc(newTextNode(".", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.right,
          ]);
        },
      ),
    };
  },
  ParenthesizedExpression: (node: Node<ts.ParenthesizedExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ParenthesizedExpression", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression"],
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          const openingParen = newTextNode("(", LabelStyle.SYNTAX_SYMBOL);
          const closingParen = newTextNode(")", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(openingParen),
              childDocs.expression,
              leafDoc(closingParen),
            ]),
          );
        },
      ),
    };
  },
  ParenthesizedTypeNode: (node: Node<ts.ParenthesizedTypeNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ParenthesizedTypeNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["type"],
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          const openingParen = newTextNode("(", LabelStyle.SYNTAX_SYMBOL);
          const closingParen = newTextNode(")", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(openingParen),
              childDocs.type,
              leafDoc(closingParen),
            ]),
          );
        },
      ),
    };
  },
  ConditionalExpression: (node: Node<ts.ConditionalExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ConditionalExpression", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["condition", "whenTrue", "whenFalse"],
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          return groupDoc([
            newFocusMarker(),
            childDocs.condition,
            lineDoc(),
            leafDoc(newTextNode("? ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.whenTrue,
            lineDoc(),
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
            childDocs.whenFalse,
          ]);
        },
      ),
    };
  },
  ImportDeclaration: (node: Node<ts.ImportDeclaration>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ImportDeclaration", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["importClause", "moduleSpecifier"],
        ({
          childDocs,
          shouldHideChild,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          const fromKeyword = leafDoc(
            newTextNode(" from ", LabelStyle.SYNTAX_SYMBOL),
          );
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(newTextNode("import ", LabelStyle.SYNTAX_SYMBOL)),
              !shouldHideChild("importClause") && [
                childDocs.importClause,
                fromKeyword,
              ],
              childDocs.moduleSpecifier,
            ]),
          );
        },
      ),
    };
  },
  ImportClause: (node: Node<ts.ImportClause>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ImportClause", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name", "namedBindings"],
        ({
          childDocs,
          shouldHideChild,
          newTextNode,
          newFocusMarker,
        }): Doc | undefined => {
          const comma = leafDoc(newTextNode(", ", LabelStyle.SYNTAX_SYMBOL));
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("name") && childDocs.name,
              !shouldHideChild("name") &&
                !shouldHideChild("namedBindings") &&
                comma,
              !shouldHideChild("namedBindings") && childDocs.namedBindings,
            ]),
          );
        },
      ),
    };
  },
  NamespaceImport: (node: Node<ts.NamespaceImport>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "NamespaceImport", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["name"],
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              leafDoc(newTextNode("* as ", LabelStyle.SYNTAX_SYMBOL)),
              childDocs.name,
            ]),
          );
        },
      ),
    };
  },
  NamedImports: makeWrappedListEnhancer("NamedImports", "{", ",", "}"),
  ImportSpecifier: (node: Node<ts.ImportSpecifier>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "ImportSpecifier", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["propertyName", "name"],
        ({
          childDocs,
          shouldHideChild,
          showChildNavigationHints,
          newTextNode,
          newFocusMarker,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          var propertyNameWithColon = [
            childDocs.propertyName,
            leafDoc(newTextNode(": ", LabelStyle.SYNTAX_SYMBOL)),
          ];
          return groupDoc(
            filterTruthyChildren([
              newFocusMarker(),
              !shouldHideChild("propertyName") && propertyNameWithColon,
              childDocs.name,
            ]),
          );
        },
      ),
    };
  },
  TypeLiteralNode: makeWrappedListEnhancer("TypeLiteralNode", "{", ",", "}"),
};
[
  ["TypeQueryNode", "typeof"],
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
[
  ["AnyKeyword", "any"],
  ["UnknownKeyword", "unknown"],
  ["NumberKeyword", "number"],
  ["ObjectKeyword", "object"],
  ["NumberKeyword", "number"],
  ["BooleanKeyword", "boolean"],
  ["StringKeyword", "string"],
  ["SymbolKeyword", "symbol"],
  ["VoidKeyword", "void"],
  ["UndefinedKeyword", "undefined"],
  ["NeverKeyword", "never"],
  ["ThisTypeNode", "this"],
  ["EqualsToken", "="],
  ["LessThanToken", "<"],
  ["GreaterThanToken", ">"],
  ["LessThanEqualsToken", "<="],
  ["GreaterThanEqualsToken", ">="],
  ["EqualsEqualsToken", "=="],
  ["ExclamationEqualsToken", "!="],
  ["EqualsEqualsEqualsToken", "==="],
  ["ExclamationEqualsEqualsToken", "!=="],
  ["PlusToken", "+"],
  ["MinusToken", "-"],
  ["AsteriskToken", "*"],
  ["AsteriskAsteriskToken", "**"],
  ["SlashToken", "/"],
  ["PercentToken", "%"],
  ["PlusPlusToken", "++"],
  ["MinusMinusToken", "--"],
  ["LessThanLessThanToken", "<<"],
  ["GreaterThanGreaterThanToken", ">>"],
  ["GreaterThanGreaterThanGreaterThanToken", ">>>"],
  ["AmpersandToken", "&"],
  ["BarToken", "|"],
  ["CaretToken", "^"],
  ["ExclamationToken", "!"],
  ["TildeToken", "~"],
  ["AmpersandAmpersandToken", "&&"],
  ["BarBarToken", "||"],
  ["QuestionQuestionToken", "??"],
  ["PlusEqualsToken", "+="],
  ["MinusEqualsToken", "-="],
  ["AsteriskEqualsToken", "*="],
  ["AsteriskAsteriskEqualsToken", "**="],
  ["SlashEqualsToken", "/="],
  ["PercentEqualsToken", "%="],
  ["LessThanLessThanEqualsToken", "<<="],
  ["GreaterThanGreaterThanEqualsToken", ">>="],
  ["GreaterThanGreaterThanGreaterThanEqualsToken", ">>>="],
  ["AmpersandEqualsToken", "&="],
  ["BarEqualsToken", "|="],
  ["CaretEqualsToken", "^="],
  ["QuestionDotToken", "?."],
  ["QuestionToken", "?"],
  ["DotDotDotToken", "..."],
].forEach(([tsType, displayKeyword]) => {
  enhancers[tsType] = (node: Node<unknown>, parentPath) => {
    const label: LabelPart[] = [
      { text: displayKeyword, style: LabelStyle.KEYWORD },
    ];
    return {
      displayInfo: { priority: DisplayInfoPriority.MEDIUM, label },
      buildDoc: ({
        nodeForDisplay,
        updatePostLayoutHints,
        measureLabel,
      }: BuildDivetreeDisplayTreeArgs): Doc | undefined => {
        updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
          ...oldHints,
          styleAsText: true,
        }));
        return leafDoc({
          kind: NodeKind.TightLeaf,
          id: nodeForDisplay.id,
          size: arrayFromTextSize(measureLabel(label)),
        });
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
