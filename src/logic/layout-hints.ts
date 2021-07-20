import type { LabelPart } from "./tree/node";

export interface PostLayoutHints {
  styleAsText?: boolean;
  label?: LabelPart[];
  showNavigationHints?: boolean;
}
