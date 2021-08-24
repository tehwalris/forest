// src/logic/delayed-input.ts

type DelayedInput = string;
var useRef: any;
var useCallback: any;
var useEffect: any;
var useState: <T>(...args: any) => any;

export function useDelayedInput(
  _handleInput: (input: DelayedInput) => void,
): (input: DelayedInput) => void {
  const latestInput = useRef(_handleInput);
  latestInput.current = _handleInput;
  const [queue, setQueue] = useState<DelayedInput[]>([]);
  const queueEmptyRef = useRef(false);
  queueEmptyRef.current = !queue.length;
  const justHandled = useRef(false);
  justHandled.current = false;
  const queueInput = useCallback((input: DelayedInput) => {
    if (queueEmptyRef.current && !justHandled.current) {
      justHandled.current = true;
      latestInput.current(input);
    } else {
      queueEmptyRef.current = false;
      setQueue((oldQueue) => [...oldQueue, input]);
    }
  }, []);
  useEffect(() => {
    if (!queue.length) {
      return;
    }
    const input = queue[0];
    setQueue((oldQueue) => oldQueue.slice(1));
    latestInput.current(input);
  });
  return queueInput;
}
