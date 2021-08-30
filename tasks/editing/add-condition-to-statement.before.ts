var queueInput: any;
var DelayedInputKind: any;

export function onKeyDown(event: any) {
  queueInput({ kind: DelayedInputKind.KeyDown, event });
  return event.key.startsWith("Arrow");
}
