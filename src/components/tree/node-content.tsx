import * as React from "react";
import { Node } from "../../logic/tree/node";
import { ParentIndex } from "../../logic/tree/display-new";

interface Props {
  id: number | string;
  nodesById: Map<string, Node<unknown>>;
  parentsById: ParentIndex;
}

export const NodeContent: React.FC<Props> = ({
  id,
  nodesById,
  parentsById,
}) => {
  const node = nodesById.get(id as string);
  if (!node) {
    return null;
  }
  return (
    <div>
      <div>{parentsById.get(node.id)?.childKey}</div>
      <div>
        <i>
          {node.getDisplayInfo()?.label.join("") || node.getDebugLabel() || ""}
        </i>
      </div>
    </div>
  );
};
