import { Action } from "../tree/action";
import { Path } from "../tree/base";
import { Node } from "../tree/node";

export type HandleAction = (
  action: Action<any>,
  target: Path,
  childActionArgument: string | undefined,
  nodeActionArgument: Node<unknown> | undefined,
) => void;
