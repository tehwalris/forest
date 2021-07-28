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
import { PostLayoutHints } from "../../layout-hints";
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
  childPostLayoutHints: {
    [K in CK]: PostLayoutHints;
  };
  shouldHideChild: (childKey: CK) => boolean;
}
interface ExtendedDisplayTreeArgsList extends ExtendedDisplayTreeArgsBase {
  childDocs: Doc[];
  childDisplayNodes: DivetreeDisplayRootNode[];
  childIsEmpty: boolean[];
  childPostLayoutHints: PostLayoutHints[];
  shouldHideChild: (childKey: number) => boolean;
}
function withExtendedArgsStruct<CK extends string, R>(
  expectedChildKeys: CK[],
  innerBuild: (args: ExtendedDisplayTreeArgsStruct<CK>) => R | undefined,
): (args: BuildDivetreeDisplayTreeArgs) => R | undefined {
  return (args: BuildDivetreeDisplayTreeArgs) => {
    const {
      nodeForDisplay,
      buildChildDoc,
      showChildNavigationHints,
      focusPath,
      getPostLayoutHints,
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
    const childPostLayoutHints: {
      [K in CK]: PostLayoutHints;
    } = {} as any;
    for (const key of expectedChildKeys) {
      const child = nodeForDisplay.getByPath([key])!;
      childDocs[key] = buildChildDoc(child);
      childIsEmpty[key] = child.getDebugLabel() === "Option<None>";
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
      childPostLayoutHints,
      shouldHideChild,
      maybeWrapPortal,
      newTextNode,
      newFocusMarker,
    });
  };
}
function withExtendedArgsList<R>(
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
        childPostLayoutHints: childKeys.map(
          (k) => structArgs.childPostLayoutHints[k],
        ),
        shouldHideChild: (i) => structArgs.shouldHideChild(childKeys[i]),
      });
    })(originalArgs);
  };
}
const singleLineCommaListEnhancer: Enhancer<Node<ts.NodeArray<ts.Node>>> = (
  node,
) => ({
  displayInfo: { priority: DisplayInfoPriority.LOW, label: [] },
  buildDoc: withExtendedArgsList(
    ({ childDocs, newTextNode, newFocusMarker }) => {
      return groupDoc([
        newFocusMarker(),
        ...childDocs.map((c, i) =>
          i === 0
            ? c
            : groupDoc([
                leafDoc(newTextNode(", ", LabelStyle.SYNTAX_SYMBOL)),
                c,
              ]),
        ),
      ]);
    },
  ),
});
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
          {
            text: nodeForDisplay.getDebugLabel() || "",
            style: LabelStyle.VALUE,
          },
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
          {
            text: nodeForDisplay.getDebugLabel() || "",
            style: LabelStyle.VALUE,
          },
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
      buildDoc: withExtendedArgsStruct(
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
          shouldHideChild,
          childDocs,
          newTextNode,
          measureLabel,
        }): Doc | undefined => {
          const keywordLabel: LabelPart[] = [
            { text: "function ", style: LabelStyle.KEYWORD },
          ];
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: keywordLabel,
          }));
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
              leafDoc({
                kind: NodeKind.TightLeaf,
                id: nodeForDisplay.id,
                size: arrayFromTextSize(measureLabel(keywordLabel)),
              }),
              !shouldHideChild("asteriskToken") && childDocs.asteriskToken,
              childDocs.name,
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
  },
  "FunctionDeclaration.parameters": (
    node: Node<ts.NodeArray<ts.ParameterDeclaration>>,
  ) => {
    return {
      displayInfo: { priority: DisplayInfoPriority.LOW, label: [] },
      buildDoc: withExtendedArgsList(
        ({ childDocs, newTextNode, newFocusMarker }) => {
          return groupDoc([
            newFocusMarker(),
            ...childDocs.map((c) =>
              groupDoc([
                c,
                leafDoc(newTextNode(",", LabelStyle.SYNTAX_SYMBOL)),
                lineDoc(),
              ]),
            ),
          ]);
        },
      ),
    };
  },
  "FunctionDeclaration.typeParameters": singleLineCommaListEnhancer,
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
          childIsEmpty,
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
          childIsEmpty,
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
  "CallExpression.typeArguments": singleLineCommaListEnhancer,
  "CallExpression.arguments": singleLineCommaListEnhancer,
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
          return groupDoc([
            newFocusMarker(),
            leafDoc(newTextNode("{", LabelStyle.SYNTAX_SYMBOL)),
            expand
              ? groupDoc([
                  nestDoc(
                    1,
                    childDocs.map((c) => [lineDoc(LineKind.Hard), c]),
                  ),
                  lineDoc(LineKind.Hard),
                ])
              : leafDoc(ellipsis),
            leafDoc(newTextNode("}", LabelStyle.SYNTAX_SYMBOL)),
          ]);
        },
      ),
    };
  },
  ArrayLiteralExpression: (node: Node<ts.ArrayLiteralExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "array", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsList(
        ({ childDocs, newTextNode, newFocusMarker }): Doc | undefined => {
          var openingSquareBracket = leafDoc(
            newTextNode("[", LabelStyle.SYNTAX_SYMBOL),
          );
          var closingSquareBracket = leafDoc(
            newTextNode("]", LabelStyle.SYNTAX_SYMBOL),
          );
          return groupDoc([
            newFocusMarker(),
            openingSquareBracket,
            nestDoc(
              1,
              childDocs.map((c) => [
                lineDoc(LineKind.Soft),
                c,
                leafDoc(newTextNode(",", LabelStyle.SYNTAX_SYMBOL)),
              ]),
            ),
            lineDoc(LineKind.Soft),
            closingSquareBracket,
          ]);
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
  "TypeReferenceNode.typeArguments": singleLineCommaListEnhancer,
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
};
[
  ["ReturnStatement", "return"],
  ["ImportDeclaration", "import"],
  ["TypeQueryNode", "typeof"],
  ["ObjectLiteralExpression", "object"],
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
