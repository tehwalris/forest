import type { LabelPart } from "./tree/node";

export interface PostLayoutHints {
  styleAsText?: boolean;
  hideFocus?: boolean;
  label?: LabelPart[];
  showNavigationHints?: boolean;
  showShortcuts?: boolean;
  didBreak?: boolean;
  shortcutKey?: string;
}
