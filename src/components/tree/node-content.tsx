import * as React from "react";
import * as R from "ramda";
import {
  LabelStyle,
  LabelPart,
  DisplayInfo,
  DisplayInfoPriority,
} from "../../logic/tree/node";
import { ParentIndexEntry } from "../../logic/parent-index";
import { css } from "@emotion/css";
import { PostLayoutHints } from "../../logic/layout-hints";
interface Props {
  parentIndexEntry: ParentIndexEntry | undefined;
  postLayoutHints?: PostLayoutHints;
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
  if (
    p.style === LabelStyle.NAME ||
    p.style === LabelStyle.VALUE ||
    p.style === LabelStyle.SYNTAX_SYMBOL
  ) {
    return <span>{p.text}</span>;
  } else if (p.style === LabelStyle.TYPE_SUMMARY) {
    return <span className={styles.typeSummaryPart}>{p.text}</span>;
  } else {
    return <span className={styles.unknownPart}>{p.text}</span>;
  }
}
export const NodeContent: React.FC<Props> = React.memo(
  ({ parentIndexEntry, postLayoutHints }) => {
    if (!parentIndexEntry && !postLayoutHints) {
      return null;
    }
    const displayInfo: DisplayInfo = parentIndexEntry?.node.getDisplayInfo(
      parentIndexEntry.path,
    ) || {
      label: postLayoutHints?.label || [
        {
          text: parentIndexEntry?.node.getDebugLabel() || "",
          style: LabelStyle.UNKNOWN,
        },
      ],
      priority: DisplayInfoPriority.LOW,
    };
    const childKey =
      parentIndexEntry?.path && R.last(parentIndexEntry.path)?.childKey;
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
