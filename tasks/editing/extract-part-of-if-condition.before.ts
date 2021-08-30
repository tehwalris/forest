var event: any;
var inProgressAction: any;
var queueInput: any;
var DelayedInputKind: any;

export function example() {
  if (!inProgressAction || event.key === "Escape") {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
    }
    queueInput({ kind: DelayedInputKind.KeyDown, event });
  }
  return event.key.startsWith("Arrow");
}
