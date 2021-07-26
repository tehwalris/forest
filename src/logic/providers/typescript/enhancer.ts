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
      buildChildDisplayTree,
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
      childDisplayNodes[key] = buildChildDisplayTree(child);
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
    return innerBuild({
      ...args,
      childDocs,
      childDisplayNodes,
      childIsEmpty,
      childPostLayoutHints,
      shouldHideChild,
      maybeWrapPortal,
      newTextNode,
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
    ({ nodeForDisplay, childDocs, newTextNode, updatePostLayoutHints }) => {
      updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
        ...oldHints,
        styleAsText: true,
      }));
      return groupDoc(
        childDocs.map((c, i) =>
          i === 0
            ? c
            : groupDoc([
                leafDoc(newTextNode(", ", LabelStyle.SYNTAX_SYMBOL)),
                c,
              ]),
        ),
      );
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
      buildDoc: withExtendedArgsStruct(
        ["dotDotDotToken", "name", "questionToken", "type", "initializer"],
        ({
          nodeForDisplay,
          updatePostLayoutHints,
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
        }) => {
          if (showChildNavigationHints) {
            return undefined;
          }
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [],
          }));
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
          expand,
          shouldHideChild,
          childDocs,
          newTextNode,
          measureLabel,
        }): Doc | undefined => {
          if (!expand) {
            return undefined;
          }
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
          return groupDoc(
            filterTruthyChildren([
              leafDoc({
                kind: NodeKind.TightLeaf,
                id: nodeForDisplay.id,
                size: arrayFromTextSize(measureLabel(keywordLabel)),
              }),
              !shouldHideChild("typeParameters") && childDocs.typeParameters,
              !shouldHideChild("asteriskToken") && childDocs.asteriskToken,
              childDocs.name,
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
              leafDoc(newTextNode("{", LabelStyle.SYNTAX_SYMBOL)),
              nestDoc(1, groupDoc([lineDoc(), childDocs.body])),
              lineDoc(),
              leafDoc(newTextNode("}", LabelStyle.SYNTAX_SYMBOL)),
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
        ({ nodeForDisplay, childDocs, newTextNode, updatePostLayoutHints }) => {
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
          }));
          return groupDoc(
            childDocs.map((c) =>
              groupDoc([
                c,
                leafDoc(newTextNode(",", LabelStyle.SYNTAX_SYMBOL)),
                lineDoc(),
              ]),
            ),
          );
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
  PropertyAccessExpression: (node: Node<ts.PropertyAccessExpression>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "property access", style: LabelStyle.TYPE_SUMMARY }],
      },
      buildDoc: withExtendedArgsStruct(
        ["expression", "questionDotToken", "name"],
        ({
          nodeForDisplay,
          updatePostLayoutHints,
          shouldHideChild,
          childDocs,
          childIsEmpty,
          showChildNavigationHints,
          newTextNode,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [],
          }));
          const questionToken = newTextNode("?", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              childDocs.expression,
              !shouldHideChild("questionDotToken") &&
                (childIsEmpty.questionDotToken
                  ? childDocs.questionDotToken
                  : leafDoc(questionToken)),
              leafDoc(newTextNode(".", LabelStyle.SYNTAX_SYMBOL)),
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
          nodeForDisplay,
          updatePostLayoutHints,
          shouldHideChild,
          childDocs,
          childIsEmpty,
          showChildNavigationHints,
          newTextNode,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [],
          }));
          const questionDotToken = newTextNode("?.", LabelStyle.SYNTAX_SYMBOL);
          const openingArrow = newTextNode("<", LabelStyle.SYNTAX_SYMBOL);
          const closingArrow = newTextNode(">", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
              childDocs.expression,
              !shouldHideChild("questionDotToken") &&
                (childIsEmpty.questionDotToken
                  ? childDocs.questionDotToken
                  : leafDoc(questionDotToken)),
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
  TypeReferenceNode: (node: Node<ts.TypeReferenceNode>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [{ text: "TypeReferenceNode", style: LabelStyle.UNKNOWN }],
      },
      buildDoc: withExtendedArgsStruct(
        ["typeName", "typeArguments"],
        ({
          nodeForDisplay,
          updatePostLayoutHints,
          shouldHideChild,
          childDocs,
          showChildNavigationHints,
          newTextNode,
        }): Doc | undefined => {
          if (showChildNavigationHints) {
            return undefined;
          }
          updatePostLayoutHints(nodeForDisplay.id, (oldHints) => ({
            ...oldHints,
            styleAsText: true,
            label: [],
          }));
          const openingArrow = newTextNode("<", LabelStyle.SYNTAX_SYMBOL);
          const closingArrow = newTextNode(">", LabelStyle.SYNTAX_SYMBOL);
          return groupDoc(
            filterTruthyChildren([
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
};
[
  ["ReturnStatement", "return"],
  ["ImportDeclaration", "import"],
  ["TypeQueryNode", "typeof"],
  ["ArrayLiteralExpression", "array"],
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
