import { Cursor } from "./interfaces";

export function adjustPostActionCursor(cursor: Cursor): Cursor {
  return { ...cursor, enableReduceToTip: false };
}
