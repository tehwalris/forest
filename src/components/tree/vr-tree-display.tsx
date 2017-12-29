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
import * as three from "three";
import SurroundNodes from "./surround-nodes";

interface Props {
  root: DisplayNode;
  highlightPath: DisplayPath;
  setPath: (path: DisplayPath) => void;
  centerX: number;
  centerY: number;
  setCenter: (x: number, y: number) => void;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

interface DragStart {
  point: Point;
  centerX: number;
  centerY: number;
}

interface State {
  dragStart?: DragStart;
}

const USE_MOUSE = true;
const Y_STRIDE = 0.8;
const Y_ZERO = 1.5;
const RADIUS_SCALE = 1.3;
const RADIUS_BASE = 2;

(window as any).AFRAME.registerGeometry("sinkhole", {
  schema: {
    extraRadius: { default: 0, min: 0 },
  },
  init: function(data: any) {
    this.geometry = new three.Geometry();

    const max = 50;
    for (let i = 0; i < max; i++) {
      const alpha = i * Math.PI * 2 / (max - 1);
      for (let j = 0; j < max; j++) {
        const radius =
          RADIUS_BASE * Math.max(0, RADIUS_SCALE ** (j - Y_ZERO)) +
          data.extraRadius;
        this.geometry.vertices.push(
          new three.Vector3(
            Math.cos(alpha) * radius,
            Y_STRIDE * j,
            Math.sin(alpha) * radius,
          ),
        );
      }
    }
    for (let i = 0; i < max * (max - 1) - 1; i += 1) {
      this.geometry.faces.push(new three.Face3(max + i, i + 1, i));
      this.geometry.faces.push(new three.Face3(max + i, max + i + 1, i + 1));
      /*
      this.geometry.faces.push(new three.Face3(i, i + 1, max + i));
      this.geometry.faces.push(new three.Face3(max + 1 + i, max + i, 1 + i));
      */
    }
  },
});

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

function pointToCenterXY({
  x,
  y,
  z,
}: Point): { centerX: number; centerY: number } {
  const alpha = Math.atan2(z, x);
  const beta = (alpha + 2 * Math.PI) % Math.PI;
  return { centerX: beta, centerY: y };
}

export default class VrTreeDisplay extends React.Component<Props, State> {
  lastHoverPoint?: Point;
  state: State = {};

  componentDidMount() {
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
  }

  onMouseDown = (e: MouseEvent) => {
    if (e.shiftKey && USE_MOUSE) {
      e.preventDefault();
      this.onTriggerDown();
    }
  };

  onMouseUp = (e: MouseEvent) => {
    if (USE_MOUSE) {
      e.preventDefault();
      this.onTriggerUp();
    }
  };

  onTriggerDown = () => {
    if (this.lastHoverPoint) {
      const { centerX, centerY } = this.props;
      this.setState({
        dragStart: { point: this.lastHoverPoint, centerX, centerY },
      });
    }
  };

  onTriggerUp = () => {
    this.setState({
      dragStart: undefined,
    });
  };

  onHover = (point: Point) => {
    if (point.z >= 0) {
      return;
    }
    this.lastHoverPoint = point;
    if (this.state.dragStart) {
      const drag = this.state.dragStart;
      const end = pointToCenterXY(point);
      const start = pointToCenterXY(drag.point);
      const approxWidth = 3 ** (drag.centerY - Y_ZERO) * Math.PI;
      this.props.setCenter(
        drag.centerX + (-end.centerX + start.centerX) / approxWidth,
        drag.centerY - end.centerY + start.centerY,
      );
    }
  };

  render() {
    const { root, highlightPath, setPath, centerX, centerY } = this.props;
    const target = getDeepestPossibleByDisplayPath(highlightPath, root);
    const positionalTree = buildPositionalTree(root);
    const yToRadius = (y: number) =>
      RADIUS_BASE * Math.max(0, RADIUS_SCALE ** (y - centerY));
    return (
      <Entity>
        <Entity
          class="interactive"
          geometry={{ primitive: "sinkhole" }}
          material={{ opacity: 0, depthTest: false }}
          events={{
            "raycaster-intersected": (e: any) => {
              if (
                e.detail.el.nodeName === (USE_MOUSE ? "A-CURSOR" : "A-ENTITY")
              ) {
                const { point } = e.detail.intersection;
                this.onHover(point);
              }
            },
          }}
        />
        <Entity
          vive-controls="hand: left"
          events={{
            triggerdown: this.onTriggerDown,
            triggerup: this.onTriggerUp,
          }}
        />
        <Entity
          vive-controls="hand: right"
          events={{
            triggerdown: this.onTriggerDown,
            triggerup: this.onTriggerUp,
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
  }
}
