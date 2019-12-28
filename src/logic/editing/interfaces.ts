import { Action } from "../tree/action";
import { Path } from "../tree/base";

export type HandleAction = (
  action: Action<any>,
  target: Path,
  childActionArgument: string | undefined,
) => void;
