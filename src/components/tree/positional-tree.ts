import { DisplayNode } from "../../logic/tree/display";

export interface PositionalTree {
  layers: PositionalTreeLayer[];
}

export interface PositionalTreeLayer {
  width: number;
  nodes: PositionalTreeNode[];
}

export interface PositionalTreeNode {
  startX: number;
  endX: number;
  childCenters: number[];
  displayNode: DisplayNode;
}
