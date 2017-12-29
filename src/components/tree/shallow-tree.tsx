import * as React from "react";
import { Entity } from "aframe-react";
import { DisplayNode } from "../../logic/tree/display";

export interface SimpleNode {
  label: string;
}

export interface ShallowTree {
  displayNode: DisplayNode;
  root: SimpleNode;
  children: SimpleNode[];
}

interface Props {
  width: number;
  tree: ShallowTree;
  onClick: () => void;
}

export default ({ tree, width, onClick }: Props) => {
  return (
    <Entity
      geometry={{
        primitive: "box",
        depth: 0.2,
        width: width,
        height: 1.3,
      }}
      material={{ color: "red", opacity: 0.2 }}
      events={{
        click: onClick,
      }}
    >
      <Entity
        text={{
          value: [tree.root, ...tree.children].map(e => e.label).join("\n\n"),
          align: "center",
          width: 2 * width,
        }}
      />
    </Entity>
  );
};
