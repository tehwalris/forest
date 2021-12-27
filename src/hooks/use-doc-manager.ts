import { useEffect, useState } from "react";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
} from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { defaultPrettierOptions } from "../logic/print";
export function useDocManager(
  initialDoc: Doc,
  readOnly: boolean,
  init: ((docManager: DocManager) => void) | undefined,
): [DocManager, DocManagerPublicState] {
  const [publicState, setPublicState] = useState<DocManagerPublicState>(
    initialDocManagerPublicState,
  );
  const [docManager, setDocManager] = useState(
    new DocManager(
      initialDoc,
      setPublicState,
      readOnly,
      defaultPrettierOptions,
    ),
  );
  useEffect(() => {
    setDocManager((oldDocManager) => {
      let initDone = false;
      const newDocManager = new DocManager(
        initialDoc,
        (state) => {
          if (initDone) {
            setPublicState(state);
          }
        },
        readOnly,
        defaultPrettierOptions,
      );
      init?.(newDocManager);
      initDone = true;
      if (newDocManager.initialDoc === oldDocManager.initialDoc) {
        (newDocManager as any).doc = (oldDocManager as any).doc;
        (newDocManager as any).history = (oldDocManager as any).history;
      }
      return newDocManager;
    });
  }, [initialDoc, readOnly, init]);
  useEffect(() => {
    docManager.forceUpdate();
    return () => {
      docManager.disableUpdates();
    };
  }, [docManager]);
  return [docManager, publicState];
}
