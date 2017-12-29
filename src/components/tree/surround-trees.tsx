import * as React from "react";
import ShallowTreeDisplay, { ShallowTree } from "./shallow-tree";
import { Entity } from "aframe-react";
import { DisplayPath } from "../../logic/tree/display";

const TREE_PADDING = 0.05;
const TREE_OUTER_WIDTH = 0.8;
const TREE_INNER_WIDTH = TREE_OUTER_WIDTH - 2 * TREE_PADDING;

interface Props {
  trees: ShallowTree[];
  radius: number;
  setPath: (path: DisplayPath) => void;
}

export default ({ trees, radius, setPath }: Props) => {
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
            <ShallowTreeDisplay
              tree={tree}
              width={TREE_INNER_WIDTH}
              onClick={() => setPath(tree.displayNode.displayPath)}
            />
          </Entity>
        );
      })}
    </Entity>
  );
};
