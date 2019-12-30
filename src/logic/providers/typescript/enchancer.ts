import {
  Node,
  DisplayInfoPriority,
  LabelStyle,
  DisplayInfo,
  LabelPart,
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

    const nameResult = node.getByPath(["name"])!.build();
    const name =
      nameResult.ok && (nameResult.value as ts.Identifier | undefined)?.text;
    if (name) {
      label.push(
        {
          text: " ",
          style: LabelStyle.WHITESPACE,
        },
        {
          text: name,
          style: LabelStyle.NAME,
        },
      );
    }

    return {
      displayInfo: {
        priority: DisplayInfoPriority.MEDIUM,
        label,
      },
    };
  }) as Enchancer<Node<ts.ClassDeclaration>>,
};
