import * as React from "react";
import { useRef } from "react";
import { CharSelection, DocRenderLine } from "../logic/render";
import { Line } from "./line";
interface Props {
  lines: DocRenderLine[];
  viewportHeightLines: number;
}
type Range = [number, number];
function getMatchingRange<T>(
  values: T[],
  cb: (v: T) => unknown,
): Range | undefined {
  let range: Range | undefined;
  for (const [i, v] of values.entries()) {
    if (!cb(v)) {
      continue;
    }
    if (range) {
      range[1] = i;
    } else {
      range = [i, i];
    }
  }
  return range;
}
function countOverlap(a: Range | undefined, b: Range | undefined): number {
  if (a === undefined || b === undefined) {
    return 0;
  }
  if (a[0] > b[0]) {
    return countOverlap(b, a);
  }
  if (a[1] < b[0]) {
    return 0;
  }
  return Math.min(a[1], b[1]) - b[0] + 1;
}
function rangeContainsLocation(
  a: Range | undefined,
  b: number | undefined,
): boolean {
  return countOverlap(a, b === undefined ? undefined : [b, b]) === 1;
}
interface CandidateOffset {
  offset: number;
  visibleTipCount: number;
  visibleNormalCount: number;
  startOfTipVisible: boolean;
  startOfNormalVisible: boolean;
}
export const FollowLines = ({
  lines,
  viewportHeightLines: _viewportHeightLines,
}: Props) => {
  const viewportHeightLines = Math.max(_viewportHeightLines, 10);
  const tipRange = getMatchingRange(lines, (l) =>
    l.regions.find(
      (r) =>
        r.selection & CharSelection.Tip &&
        r.selection & CharSelection.PrimaryCursor,
    ),
  );
  const normalRange = getMatchingRange(lines, (l) =>
    l.regions.find(
      (r) =>
        r.selection & CharSelection.Normal &&
        r.selection & CharSelection.PrimaryCursor,
    ),
  );
  const evaluateOffset = (offset: number): CandidateOffset => {
    const visibleRange: Range = [offset, offset + viewportHeightLines - 1];
    return {
      offset,
      visibleTipCount: countOverlap(visibleRange, tipRange),
      visibleNormalCount: countOverlap(visibleRange, normalRange),
      startOfTipVisible:
        tipRange !== undefined &&
        rangeContainsLocation(visibleRange, tipRange[0]),
      startOfNormalVisible:
        normalRange !== undefined &&
        rangeContainsLocation(visibleRange, normalRange[0]),
    };
  };
  const oldOffsetRef = useRef(0);
  const alignTopPadded = (
    r: Range | undefined,
    paddingTop: number,
  ): number | undefined =>
    r === undefined ? undefined : Math.max(r[0] - paddingTop, 0);
  const candidateOffsets = [
    alignTopPadded(tipRange, 5),
    alignTopPadded(normalRange, 5),
    alignTopPadded(tipRange, 1),
    alignTopPadded(normalRange, 1),
    oldOffsetRef.current,
  ]
    .filter((v) => v !== undefined)
    .map((v) => evaluateOffset(v!));
  const offset = candidateOffsets.reduce((a, c) =>
    c.visibleTipCount > a.visibleTipCount ||
    (c.visibleTipCount === a.visibleTipCount &&
      c.visibleNormalCount > a.visibleNormalCount) ||
    (c.visibleTipCount === a.visibleTipCount &&
      c.visibleNormalCount === a.visibleNormalCount &&
      c.startOfTipVisible &&
      !a.startOfTipVisible) ||
    (c.visibleTipCount === a.visibleTipCount &&
      c.visibleNormalCount === a.visibleNormalCount &&
      c.startOfTipVisible === a.startOfTipVisible &&
      c.startOfNormalVisible &&
      !a.startOfNormalVisible)
      ? c
      : a,
  ).offset;
  oldOffsetRef.current = offset;
  const visibleLineIndices: number[] = [];
  visibleLineIndices.push(
    ...lines.map((l, i) => i).slice(offset, offset + viewportHeightLines),
  );
  return (
    <div style={{ whiteSpace: "pre" }}>
      {visibleLineIndices.map((i) => (
        <Line key={i} line={lines[i]} />
      ))}
    </div>
  );
};
