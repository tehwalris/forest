var event: any;
var inProgressAction: any;
var queueInput: any;
var DelayedInputKind: any;

export function example() {
  const ctrlLike = event.ctrlKey || event.metaKey;
  if (!inProgressAction || event.key === "Escape" || ctrlLike) {
    if (ctrlLike) {
      event.preventDefault();
      event.stopPropagation();
    }
    queueInput({ kind: DelayedInputKind.KeyDown, event });
  }
  return event.key.startsWith("Arrow");
}
