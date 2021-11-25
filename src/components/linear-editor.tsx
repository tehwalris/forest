import * as React from "react";
import { useEffect } from "react";
import { useAutofocus } from "../hooks/use-autofocus";
import { useDocManager } from "../hooks/use-doc-manager";
import { Mode } from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { DocUi } from "./doc-ui";
interface Props {
  initialDoc: Doc;
  onSave: (doc: Doc) => void;
}
export const LinearEditor = ({ initialDoc, onSave }: Props) => {
  const [codeDivRef, focusCodeDiv] = useAutofocus<HTMLDivElement>();
  useEffect(() => {
    focusCodeDiv();
  }, [initialDoc, focusCodeDiv]);
  const [docManager, docManagerState] = useDocManager(initialDoc, false);
  const { doc, mode } = docManagerState;
  return (
    <DocUi
      docManager={docManager}
      state={docManagerState}
      codeDivRef={codeDivRef}
      onKeyDown={(ev, handleWithDocManager) => {
        if (mode === Mode.Normal && ev.key === "s" && ev.ctrlKey) {
          ev.preventDefault();
          ev.stopPropagation();
          onSave(doc);
        } else {
          handleWithDocManager();
        }
      }}
    />
  );
};
