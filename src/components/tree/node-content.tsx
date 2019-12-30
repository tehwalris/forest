import * as React from "react";
import * as R from "ramda";
import { ParentIndexEntry } from "../../logic/tree/display-new";
import { SemanticColor } from "../../logic/tree/node";

interface Props {
  parentIndexEntry: ParentIndexEntry | undefined;
}

export const NodeContent: React.FC<Props> = React.memo(
  ({ parentIndexEntry }) => {
    if (!parentIndexEntry) {
      return null;
    }
    const { node, path } = parentIndexEntry;
    return (
      <div>
        <div>{R.last(path)?.childKey}</div>
        <div>
          <i>
            {node
              .getDisplayInfo()
              ?.label.map(p => p.text)
              .join("") ||
              node.getDebugLabel() ||
              ""}
          </i>
        </div>
      </div>
    );
  },
);
