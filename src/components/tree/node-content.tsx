import { css } from "@emotion/css";
import * as React from "react";
import { PostLayoutHints } from "../../logic/layout-hints";
import { ParentIndexEntry } from "../../logic/parent-index";
import {
  makeTextMeasurementFunction,
  TextMeasurementFunction,
} from "../../logic/text-measurement";
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
const defaultFont = "16px Roboto, sans-serif";
const fontFallbackHeightPx = 19.2;
const fontsByLabelStyle: { [K in LabelStyle]?: string } = {
  [LabelStyle.TYPE_SUMMARY]: `500 ${defaultFont}`,
};
export function makeTextMeasurementFunctionsByStyle(): {
  [K in LabelStyle]: TextMeasurementFunction;
} {
  const textMeasurementFunctionsByStyle: {
    [K in LabelStyle]: TextMeasurementFunction;
  } = {} as any;
  for (const _style in LabelStyle) {
    const style = _style as unknown as LabelStyle;
    textMeasurementFunctionsByStyle[style] = makeTextMeasurementFunction(
      fontsByLabelStyle[style] || defaultFont,
      fontFallbackHeightPx,
    );
  }
  return textMeasurementFunctionsByStyle;
}
const styles = {
  unknownPart: css`
    text-decoration: line-through;
  `,
  childKey: css`
    opacity: 0.5;
  `,
};
function renderLabelPart(p: LabelPart) {
  const style: React.CSSProperties = {
    font: fontsByLabelStyle[p.style] || defaultFont,
    whiteSpace: "pre",
  };
  if (
    p.style === LabelStyle.NAME ||
    p.style === LabelStyle.VALUE ||
    p.style === LabelStyle.SYNTAX_SYMBOL ||
    p.style === LabelStyle.KEYWORD
  ) {
    return <span style={style}>{p.text}</span>;
  } else if (p.style === LabelStyle.CHILD_KEY) {
    return (
      <span style={style} className={styles.childKey}>
        {p.text}
      </span>
    );
  } else {
    return (
      <span style={style} className={styles.unknownPart}>
        {p.text}
      </span>
    );
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
          <React.Fragment key={i}>{renderLabelPart(p)}</React.Fragment>
        ))}
      </div>
    );
  },
);
