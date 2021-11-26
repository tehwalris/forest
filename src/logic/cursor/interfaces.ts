import { EvenPathRange } from "../interfaces";
import { Clipboard } from "../paste";
export interface Mark {
  focus: EvenPathRange;
}
export interface Cursor {
  id: Symbol;
  parentPath: Symbol[];
  focus: EvenPathRange;
  enableReduceToTip: boolean;
  clipboard: Clipboard | undefined;
  marks: Mark[];
}
