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
    const childKey = R.last(path)?.childKey;
    return (
      <div>
        {childKey && !childKey.match(/^\d+$/) && <div>{childKey}</div>}
        {displayInfo.map((p, i) => (
          <div key={i}>
            {p.style === LabelStyle.NAME ? <i>{p.text}</i> : p.text}
          </div>
        ))}
      </div>
    );
  },
);
