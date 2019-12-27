import {
  Node,
  DisplayInfoPriority,
  LabelStyle,
  DisplayInfo,
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
  ClassDeclaration: (node => ({
    displayInfo: {
      priority: DisplayInfoPriority.MEDIUM,
      label: [{ text: "class", style: LabelStyle.SECTION_NAME }],
    },
  })) as Enchancer<Node<ts.ClassDeclaration>>,
};
