import { EvenPathRange } from "../interfaces";
import { Clipboard } from "../paste";

export interface Cursor {
  focus: EvenPathRange;
  enableReduceToTip: boolean;
  clipboard: Clipboard | undefined;
}
