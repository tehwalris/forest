import { useCallback, useState } from "react";

export function useRenderTrigger(): () => void {
  const [_dummy, setDummy] = useState({});
  const triggerRender = useCallback(() => {
    setDummy({});
  }, []);
  return triggerRender;
}
