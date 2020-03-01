import {
  Node,
  DisplayInfoPriority,
  LabelStyle,
  DisplayInfo,
  LabelPart,
  SemanticColor,
} from "../../tree/node";
import * as ts from "typescript";
import { ParentPathElement } from "../../tree/display-new";
import * as R from "ramda";

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
};
export const enchancers: {
  [key: string]: Enchancer<Node<any>> | undefined;
} = {
  Identifier: (node: Node<ts.Identifier>, parentPath) => {
    const lastParentEntry = R.last(parentPath);
    const isDeclarationName = lastParentEntry?.childKey === "name"; // HACK Clearly we need a more robust detection strategy
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
        label: [],
        color: SemanticColor.LITERAL,
      },
    };
  },
  NumericLiteral: (node: Node<ts.NumericLiteral>) => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [],
        color: SemanticColor.LITERAL,
      },
    };
  },
};
