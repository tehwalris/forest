import type { LabelPart } from "./tree/node";

export interface PreLayoutHints {
  styleAsText?: boolean;
}

export interface PostLayoutHints {
  styleAsText?: boolean;
  label?: LabelPart[];
}
