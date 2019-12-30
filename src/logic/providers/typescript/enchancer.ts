import {
  Node,
  DisplayInfoPriority,
  LabelStyle,
  DisplayInfo,
  LabelPart,
  SemanticColor,
} from "../../tree/node";
import * as ts from "typescript";
export type Enchancer<T extends Node<ts.Node>> = (
  node: T,
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
};
