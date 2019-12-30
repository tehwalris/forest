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
export type Enchancer<T extends Node<ts.Node>> = (
  node: T,
  parentPath: ParentPathElement[],
) => {
  displayInfo: DisplayInfo;
};
export const enchancers: {
  [key: string]: Enchancer<Node<any>> | undefined;
} = {
  ClassDeclaration: (node => {
    const label: LabelPart[] = [
      { text: "class", style: LabelStyle.SECTION_NAME },
    ];

    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label,
        color: SemanticColor.DECLARATION,
      },
    };
  }) as Enchancer<Node<ts.ClassDeclaration>>,
  FunctionDeclaration: (node => {
    const label: LabelPart[] = [
      { text: "function", style: LabelStyle.SECTION_NAME },
    ];
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label,
        color: SemanticColor.DECLARATION,
      },
    };
  }) as Enchancer<Node<ts.ClassDeclaration>>,
  Identifier: ((node, parentPath) => {
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
  }) as Enchancer<Node<ts.ClassDeclaration>>,
  StringLiteral: (node => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [],
        color: SemanticColor.LITERAL,
      },
    };
  }) as Enchancer<Node<ts.StringLiteral>>,
  NumericLiteral: (node => {
    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label: [],
        color: SemanticColor.LITERAL,
      },
    };
  }) as Enchancer<Node<ts.NumericLiteral>>,
};
