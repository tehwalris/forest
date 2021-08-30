var inProgressAction: any;
var queueInput: any;
var DelayedInputKind: any;

export function onKeyDown(event: any) {
  if (!inProgressAction || event.key !== "Enter") {
    queueInput({ kind: DelayedInputKind.KeyDown, event });
  }
  return event.key.startsWith("Arrow");
}
