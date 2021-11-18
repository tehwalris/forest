import * as React from "react";
import { DocRenderLine } from "../logic/render";
import { Line } from "./line";
interface Props {
  lines: DocRenderLine[];
}
export const SimpleLines = ({ lines }: Props) => (
  <div style={{ whiteSpace: "pre" }}>
    {lines.map((line, iLine) => (
      <Line key={iLine} line={line} />
    ))}
  </div>
);
