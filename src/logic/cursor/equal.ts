import { evenPathRangesAreEqual } from "../path-utils";
import { Cursor } from "./interfaces";
export function cursorsAreEqual(a: Cursor, b: Cursor): boolean {
  return (
    evenPathRangesAreEqual(a.focus, b.focus) &&
    a.enableReduceToTip === b.enableReduceToTip &&
    a.clipboard === b.clipboard
  );
}
export function cursorArraysAreEqual(aArr: Cursor[], bArr: Cursor[]): boolean {
  return (
    aArr.length === bArr.length &&
    aArr.every((a, i) => cursorsAreEqual(a, bArr[i]))
  );
}
