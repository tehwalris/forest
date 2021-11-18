import * as React from "react";
import { DocRenderLine, getStyleForSelection } from "../logic/render";
interface Props {
  line: DocRenderLine;
}
export const Line = ({ line }: Props) => (
  <div>
    {!line.regions.length && <br />}
    {line.regions.map((region, iRegion) => (
      <span key={iRegion} style={getStyleForSelection(region.selection)}>
        {region.text}
      </span>
    ))}
  </div>
);
