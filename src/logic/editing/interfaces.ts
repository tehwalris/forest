import { Action } from "../tree/action";
import { Path } from "../tree/base";
import { Node } from "../tree/node";

export type HandleAction = (
  action: Action<any>,
  target: Path,
  focus: ((newNode: Node<unknown>) => string) | undefined,
  childActionArgument: string | undefined,
  childIndexActionArgument: number | undefined,
  nodeActionArgument: Node<unknown> | undefined,
) => void;
