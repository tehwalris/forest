import { css } from "@emotion/css";
import * as React from "react";
import { PostLayoutHints } from "../../logic/layout-hints";
import { ParentIndexEntry } from "../../logic/parent-index";
import {
  DisplayInfo,
  DisplayInfoPriority,
  LabelPart,
  LabelStyle,
} from "../../logic/tree/node";
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
    let displayInfo: DisplayInfo = parentIndexEntry?.node.getDisplayInfo(
      parentIndexEntry.path,
    ) || {
      label: [
        {
          text: parentIndexEntry?.node.getDebugLabel() || "",
          style: LabelStyle.UNKNOWN,
        },
      ],
      priority: DisplayInfoPriority.LOW,
    };
    if (postLayoutHints?.label) {
      displayInfo = { ...displayInfo, label: postLayoutHints.label };
    }
    return (
      <div>
        {displayInfo.label.map((p, i) => (
          <div key={i}>{renderLabelPart(p)}</div>
        ))}
      </div>
    );
  },
);
