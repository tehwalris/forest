import * as React from "react";
import ShallowTreeDisplay, { ShallowTree } from "./shallow-tree";
import { Entity } from "aframe-react";

const TREE_PADDING = 0.05;
const TREE_OUTER_WIDTH = 0.8;
const TREE_INNER_WIDTH = TREE_OUTER_WIDTH - 2 * TREE_PADDING;

interface Props {
  trees: ShallowTree[];
  radius: number;
}

export default ({ trees, radius }: Props) => {
  const alpha = 2 * Math.asin(TREE_OUTER_WIDTH / (2 * radius));
  return (
    <Entity>
      {trees.map((tree, i) => {
        const a = i * alpha - (trees.length + 1) * alpha / 2 - 45;
        return (
          <Entity
            key={i}
            position={{
              x: radius * Math.cos(a),
              y: 1.5,
              z: radius * Math.sin(a),
            }}
            rotation={{ x: 0, y: -a / Math.PI * 180 - 90, z: 0 }}
          >
            <ShallowTreeDisplay tree={tree} width={TREE_INNER_WIDTH} />
          </Entity>
        );
      })}
    </Entity>
  );
};

/*
    <Entity>
      <Entity
        key="hello"
        text={{ value: "Hello, A-Frame React!", align: "center" }}
        position={{ x: 0, y: 2, z: -1 }}
      />
      <Entity
        key="box"
        geometry={{ primitive: "box" }}
        material={{ color: "red", opacity: 0.6 }}
        position={{ x: 0, y: 1, z: -3 }}
        events={{ click: () => console.log("test") }}
      >
        <Entity
          geometry={{ primitive: "box", depth: 0.2, height: 0.2, width: 0.2 }}
          material={{ color: "#24CAFF" }}
        />
      </Entity>
    </Entity>

    */
