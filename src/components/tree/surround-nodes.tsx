import * as React from "react";
import { Entity } from "aframe-react";
import { PositionalTreeLayer, PositionalTreeNode } from "./positional-tree";
import { DisplayNode, nodesFromDisplayNode } from "../../logic/tree/display";
import * as R from "ramda";
import { USE_MOUSE } from "./config";

const TREE_PADDING = 0.05;
const TREE_OUTER_WIDTH = 0.8;
const TREE_INNER_WIDTH = TREE_OUTER_WIDTH - 2 * TREE_PADDING;
const TREE_INNER_HEIGHT = 0.3;
const ACTIVE_ANGLE = Math.PI * 1.5;

interface Props {
  layer: PositionalTreeLayer;
  centerX: number;
  radius: number;
  nextRadius: number;
  nextYOffset: number;
  nextLayerWidth: number;
  onRayEnter: (node: PositionalTreeNode) => void;
  onRayLeave: () => void;
  selectedNode: DisplayNode | undefined;
}

const labelCache = new WeakMap<DisplayNode, string>();

function labelDisplayNodeUncached(node: DisplayNode): string {
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

function labelDisplayNode(node: DisplayNode): string {
  if (!labelCache.has(node)) {
    labelCache.set(node, labelDisplayNodeUncached(node));
  }
  return labelCache.get(node)!;
}

export default ({
  layer,
  radius,
  nextRadius,
  centerX,
  nextYOffset,
  nextLayerWidth,
  onRayEnter,
  onRayLeave,
  selectedNode,
}: Props) => {
  // const alpha = 2 * Math.asin(TREE_OUTER_WIDTH / (2 * radius));
  // const rangeT = ACTIVE_ANGLE * radius;
  const xIntoT = (x: number) => (x - centerX) * layer.width;
  const xIntoTNext = (x: number) => (x - centerX) * nextLayerWidth;
  const tIntoAlpha = (t: number) => t / radius;
  const tIntoAlphaNext = (t: number) => t / nextRadius;
  return (
    <Entity>
      {layer.nodes
        .map((node, i) => ({
          node,
          alpha:
            tIntoAlpha(xIntoT((node.startX + node.endX) / 2)) - Math.PI / 2,
          i,
        }))
        .filter(e => e.alpha >= -ACTIVE_ANGLE && e.alpha <= 0)
        .map(({ node, alpha, i }) => {
          return (
            <Entity
              key={`node ${i}`}
              position={{
                x: radius * Math.cos(alpha),
                y: 0,
                z: radius * Math.sin(alpha),
              }}
              rotation={{ x: 0, y: -alpha / Math.PI * 180 - 90, z: 0 }}
            >
              <Entity
                geometry={{
                  primitive: "plane",
                  width: TREE_INNER_WIDTH,
                  height: TREE_INNER_HEIGHT,
                }}
                position="0 0 -0.02"
                material={{
                  color: node.displayNode === selectedNode ? "green" : "red",
                  opacity: 0.8,
                }}
              />
              <Entity
                class="interactive"
                geometry={{
                  primitive: "box",
                  depth: 0.04,
                  width: TREE_INNER_WIDTH,
                  height: TREE_INNER_HEIGHT,
                }}
                events={{
                  "raycaster-intersected": (e: any) => {
                    if (
                      e.detail.el.nodeName ===
                      (USE_MOUSE ? "A-CURSOR" : "A-ENTITY")
                    ) {
                      onRayEnter(node);
                    }
                  },
                  "raycaster-intersected-cleared": (e: any) => {
                    if (
                      e.detail.el.nodeName ===
                      (USE_MOUSE ? "A-CURSOR" : "A-ENTITY")
                    ) {
                      onRayLeave();
                    }
                  },
                }}
                material={{
                  color: node.displayNode === selectedNode ? "green" : "red",
                  opacity: 0.2,
                }}
              >
                <Entity
                  text={{
                    value: labelDisplayNode(node.displayNode),
                    align: "center",
                    wrapCount: 30,
                  }}
                />
              </Entity>
            </Entity>
          );
        })}
      {R.chain(
        e =>
          e.childCenters.map(c => ({ fromX: (e.startX + e.endX) / 2, toX: c })),
        layer.nodes,
      )
        .map(e => {
          const fromAlpha = tIntoAlpha(xIntoT(e.fromX)) - Math.PI / 2;
          const toAlpha = tIntoAlphaNext(xIntoTNext(e.toX)) - Math.PI / 2;
          return { fromAlpha, toAlpha, toX: e.toX };
        })
        .filter(
          e =>
            e.fromAlpha >= -ACTIVE_ANGLE &&
            e.fromAlpha <= 0 &&
            e.toAlpha >= -ACTIVE_ANGLE &&
            e.toAlpha <= 0,
        )
        .map(({ fromAlpha, toAlpha, toX }, i) => {
          const fromSpaceX = radius * Math.cos(fromAlpha);
          const fromSpaceZ = radius * Math.sin(fromAlpha);
          const toSpaceX = nextRadius * Math.cos(toAlpha);
          const toSpaceZ = nextRadius * Math.sin(toAlpha);
          return (
            <Entity
              key={`${toX}`}
              line={`start: ${fromSpaceX}, ${TREE_INNER_HEIGHT /
                2}, ${fromSpaceZ}; end: ${toSpaceX} ${nextYOffset -
                TREE_INNER_HEIGHT / 2} ${toSpaceZ}; color: yellow`}
            />
          );
        })}
    </Entity>
  );
};
