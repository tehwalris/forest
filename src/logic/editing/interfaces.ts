import { Action } from "../tree/action";
import { Path } from "../tree/base";
import { Node } from "../tree/node";
export type HandleAction = (
  action: Action<any>,
  target: Path,
  focus: ((newNode: Node<unknown>) => string) | undefined,
  actionArguments: ActionArguments,
) => void;
interface ActionArguments {
  childIndex?: number;
  child?: string;
  node?: Node<unknown>;
  triggerAutoAction?: boolean;
}
