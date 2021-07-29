import { useState, useCallback, useEffect, useRef } from "react";
export enum DelayedInputKind {
  KeyUp,
  KeyDown,
}
export type DelayedInput =
  | {
      kind: DelayedInputKind.KeyUp;
      event: KeyboardEvent;
    }
  | {
      kind: DelayedInputKind.KeyDown;
      event: KeyboardEvent;
    };
export function useDelayedInput(
  handleInput: (input: DelayedInput) => void,
): (input: DelayedInput) => void {
  const [queue, setQueue] = useState<DelayedInput[]>([]);
  const queueEmptyRef = useRef(false);
  queueEmptyRef.current = !queue.length;
  const immediatelyHandledThisRenderRef = useRef(false);
  immediatelyHandledThisRenderRef.current = false;
  const queueInput = useCallback(
    (input: DelayedInput) => {
      if (queueEmptyRef.current && !immediatelyHandledThisRenderRef.current) {
        immediatelyHandledThisRenderRef.current = true;
        handleInput(input);
      } else {
        queueEmptyRef.current = false;
        setQueue((oldQueue) => [...oldQueue, input]);
      }
    },
    [handleInput],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!queue.length) {
      return;
    }
    const input = queue[0];
    setQueue((oldQueue) => oldQueue.slice(1));
    handleInput(input);
  });
  return queueInput;
}
