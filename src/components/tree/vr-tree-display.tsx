import * as React from "react";
// import SurroundTrees from "./surround-trees";
import { Entity } from "aframe-react";
import {
  PositionalTree,
  PositionalTreeLayer,
  PositionalTreeNode,
} from "./positional-tree";
import {
  DisplayNode,
  DisplayPath,
  nodesFromDisplayNode,
} from "../../logic/tree/display";
// import { ShallowTree } from "./shallow-tree";
import * as R from "ramda";
import SurroundNodes from "./surround-nodes";

interface Props {
  root: DisplayNode;
  highlightPath: DisplayPath;
  setPath: (path: DisplayPath) => void;
  centerX: number;
  centerY: number;
  setCenter: (x: number, y: number) => void;
}

const Y_STRIDE = 0.8;
const Y_ZERO = 1.5;
const RADIUS_SCALE = 1.3;
const RADIUS_ZERO = 1;

function getDeepestPossibleByDisplayPath(
  path: DisplayPath,
  parent: DisplayNode,
): DisplayNode {
  if (path.length) {
    const childNode = parent.children[path[0]];
    if (childNode) {
      return getDeepestPossibleByDisplayPath(path.slice(1), childNode);
    }
  }
  return parent;
}

function labelDisplayNode(node: DisplayNode): string {
  const fullChain = nodesFromDisplayNode(node);
  const debugLabel = fullChain.reduce(
    (a, c) => c.node.getDebugLabel() || a,
    "",
  );
  const built = node.baseNode.build();
  const path = fullChain[fullChain.length - 1].path
    .slice(Math.max(0, node.basePath.length - 1))
    .join("/");
  const label =
    (debugLabel ? `${path}\n${debugLabel}` : path) + (built.ok ? "" : "!");
  return label;
}

// function childrenToShallowTrees(node: DisplayNode): ShallowTree[] {
//   return node.children.map(p => ({
//     displayNode: p,
//     root: { label: labelDisplayNode(p) },
//     children: p.children.map(c => ({ label: labelDisplayNode(c) })),
//   }));
// }

function buildPositionalTree(root: DisplayNode): PositionalTree {
  let current = { width: 1, nodes: buildPartialLayer([root], 0, 1) };
  const layers = [current];
  while (true) {
    const next = buildNextLayer(current);
    if (next.nodes.length) {
      layers.push(next);
      current = next;
    } else {
      break;
    }
  }
  return { layers };
}

function buildNextLayer(base: PositionalTreeLayer): PositionalTreeLayer {
  const maxChildren = Math.max(
    ...base.nodes.map(e => e.displayNode.children.length),
  );
  const width = base.width * maxChildren;
  return {
    width,
    nodes: R.chain(
      e => buildPartialLayer(e.displayNode.children, e.startX, e.endX),
      base.nodes,
    ),
  };
}

function buildPartialLayer(
  nodes: DisplayNode[],
  wholeStartX: number,
  wholeEndX: number,
): PositionalTreeNode[] {
  const whole = wholeEndX - wholeStartX;
  const segment = whole / nodes.length;
  return nodes.map((p, i) => {
    const startX = wholeStartX + i * segment;
    const endX = wholeStartX + (i + 1) * segment;
    return {
      startX,
      endX,
      childCenters: p.children.map(
        (c, j) => startX + (j + 0.5) * (segment / p.children.length),
      ),
      displayNode: p,
    };
  });
}

export default ({
  root,
  highlightPath,
  setPath,
  centerX,
  centerY,
  setCenter,
}: Props) => {
  const target = getDeepestPossibleByDisplayPath(highlightPath, root);
  const positionalTree = buildPositionalTree(root);
  const yToRadius = (y: number) =>
    RADIUS_ZERO + Math.max(0, RADIUS_SCALE ** (y - centerY));
  return (
    <Entity>
      <Entity
        class="interactive"
        primitive="a-plane"
        material={{ color: "yellow", opacity: 0.3 }}
        position="0 0.01 -5"
        rotation="0 0 0"
        height="5"
        width="5"
        events={{
          "raycaster-intersected": (e: any) => {
            const { x, y } = e.detail.intersection.uv;
            setCenter(x, y * 5);
          },
        }}
      />
      <Entity
        vive-controls="hand: left"
        events={{
          triggerdown: (e: any) => console.log("trigger L"),
        }}
      />
      <Entity
        vive-controls="hand: right"
        events={{
          triggerdown: (e: any) => console.log("trigger R"),
        }}
      />
      {positionalTree.layers.map((layer, i) => (
        <Entity
          key={i}
          position={{ x: 0, y: i * Y_STRIDE + Y_ZERO - centerY, z: 0 }}
        >
          <SurroundNodes
            layer={positionalTree.layers[i]}
            centerX={centerX}
            radius={yToRadius(i)}
            nextRadius={yToRadius(i + 1)}
            nextYOffset={Y_STRIDE}
            nextLayerWidth={
              positionalTree.layers[i + 1]
                ? positionalTree.layers[i + 1].width
                : 0
            }
          />
        </Entity>
      ))}
      <Entity
        class="interactive"
        primitive="a-plane"
        material={{ color: "blue", opacity: 0.2 }}
        text={{
          value: labelDisplayNode(target),
          align: "center",
        }}
        position="0 0.01 -1"
        rotation="-90 0 0"
        height="5"
        width="5"
        events={{
          click: () =>
            setPath(
              highlightPath.slice(0, Math.max(highlightPath.length - 1, 0)),
            ),
        }}
      />
      {/* e.detail.intersection.point */}
    </Entity>
  );
};
