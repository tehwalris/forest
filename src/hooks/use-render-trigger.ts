import { useCallback, useState } from "react";

export function useRenderTrigger(): () => void {
  const [, setDummy] = useState({});
  const triggerRender = useCallback(() => {
    setDummy({});
  }, []);
  return triggerRender;
}
