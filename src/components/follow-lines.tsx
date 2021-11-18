import * as React from "react";
import { CharSelection, DocRenderLine } from "../logic/render";
import { Line } from "./line";
interface Props {
  lines: DocRenderLine[];
  viewportHeightLines: number;
}
function getMatchingRange<T>(
  values: T[],
  cb: (v: T) => unknown,
): [number, number] | undefined {
  let range: [number, number] | undefined;
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
export const FollowLines = ({ lines, viewportHeightLines }: Props) => {
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
  const firstVisibleLineIndex = Math.max(
    0,
    (tipRange?.[0] ?? normalRange?.[0] ?? 0) - 5,
  );
  const visibleLineIndices: number[] = [];
  visibleLineIndices.push(
    ...lines
      .map((l, i) => i)
      .slice(
        firstVisibleLineIndex,
        firstVisibleLineIndex + viewportHeightLines,
      ),
  );
  return (
    <div style={{ whiteSpace: "pre" }}>
      {visibleLineIndices.map((i) => (
        <Line key={i} line={lines[i]} />
      ))}
    </div>
  );
};
