import * as React from "react";
import * as R from "ramda";
import { ParentIndex } from "../../logic/tree/display-new";

interface Props {
  id: number | string;
  parentIndex: ParentIndex;
}

export const NodeContent: React.FC<Props> = ({ id, parentIndex }) => {
  const indexEntry = parentIndex.get(id as string);
  if (!indexEntry) {
    return null;
  }
  const { node, path } = indexEntry;
  return (
    <div>
      <div>{R.last(path)?.childKey}</div>
      <div>
        <i>
          {node.getDisplayInfo()?.label.join("") || node.getDebugLabel() || ""}
        </i>
      </div>
    </div>
  );
};
