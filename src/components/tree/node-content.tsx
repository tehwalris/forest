import * as React from "react";
import * as R from "ramda";
import { LabelStyle } from "../../logic/tree/node";
import { ParentIndexEntry } from "../../logic/parent-index";

interface Props {
  parentIndexEntry: ParentIndexEntry | undefined;
}

export const NodeContent: React.FC<Props> = React.memo(
  ({ parentIndexEntry }) => {
    if (!parentIndexEntry) {
      return null;
    }
    const { node, path } = parentIndexEntry;
    const displayInfo = node.getDisplayInfo(path)?.label || [
      { text: node.getDebugLabel() || "", style: LabelStyle.UNKNOWN },
    ];
    return (
      <div>
        <div>{R.last(path)?.childKey}</div>
        {displayInfo.map((p, i) => (
          <div key={i}>
            {p.style === LabelStyle.NAME ? <i>{p.text}</i> : p.text}
          </div>
        ))}
      </div>
    );
  },
);
