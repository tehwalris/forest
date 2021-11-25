import * as React from "react";
import { useCallback, useEffect, useRef } from "react";
export function useAutofocus<T extends HTMLElement>(): [
  React.RefObject<T>,
  () => void,
] {
  const focusedElRef = useRef<T | null>(null);
  const elRef = useRef<T>(null);
  useEffect(() => {
    if (elRef.current && elRef.current !== focusedElRef.current) {
      elRef.current.focus();
      focusedElRef.current = elRef.current;
    }
  });
  const forceFocus = useCallback(() => {
    if (elRef.current) {
      elRef.current.focus();
      focusedElRef.current = elRef.current;
    }
  }, []);
  return [elRef, forceFocus];
}
