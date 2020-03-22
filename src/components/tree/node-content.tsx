import * as React from "react";
import * as R from "ramda";
import {
  LabelStyle,
  LabelPart,
  DisplayInfo,
  DisplayInfoPriority,
} from "../../logic/tree/node";
import { ParentIndexEntry } from "../../logic/parent-index";
import { css } from "emotion";
interface Props {
  parentIndexEntry: ParentIndexEntry | undefined;
}
const styles = {
  typeSummaryPart: css`
    font-weight: 500;
  `,
  unknownPart: css`
    text-decoration: line-through;
  `,
  childKey: css`
    opacity: 0.5;
  `,
};
function renderLabelPart(p: LabelPart) {
  if (p.style === LabelStyle.NAME || p.style === LabelStyle.VALUE) {
    return <span>{p.text}</span>;
  } else if (p.style === LabelStyle.TYPE_SUMMARY) {
    return <span className={styles.typeSummaryPart}>{p.text}</span>;
  } else {
    return <span className={styles.unknownPart}>{p.text}</span>;
  }
}
export const NodeContent: React.FC<Props> = React.memo(
  ({ parentIndexEntry }) => {
    if (!parentIndexEntry) {
      return null;
    }
    const { node, path } = parentIndexEntry;
    const displayInfo: DisplayInfo = node.getDisplayInfo(path) || {
      label: [{ text: node.getDebugLabel() || "", style: LabelStyle.UNKNOWN }],
      priority: DisplayInfoPriority.LOW,
    };
    const childKey = R.last(path)?.childKey;
    return (
      <div>
        {childKey && !displayInfo.hideKey && !childKey.match(/^\d+$/) && (
          <div className={styles.childKey}>{childKey}</div>
        )}
        {displayInfo.label.map((p, i) => (
          <div key={i}>{renderLabelPart(p)}</div>
        ))}
      </div>
    );
  },
);
