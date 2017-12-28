import * as React from "react";
import { Entity } from "aframe-react";

export interface SimpleNode {
  label: string;
}

export interface ShallowTree {
  root: SimpleNode;
  children: SimpleNode[];
}

interface Props {
  width: number;
  tree: ShallowTree;
}

export default ({ tree, width }: Props) => {
  return (
    <Entity
      geometry={{
        primitive: "box",
        depth: 0.2,
        width: width,
        height: 1.3,
      }}
      material={{ color: "red", opacity: 0.2 }}
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
