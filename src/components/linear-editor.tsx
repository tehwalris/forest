import * as React from "react";
import { useEffect, useState } from "react";
import { useAutofocus } from "../hooks/use-autofocus";
import { useDocManager } from "../hooks/use-doc-manager";
import { Mode } from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { DocUi } from "./doc-ui";
import { QueryEditor } from "./query-editor";
import { Stage, State as QueryState } from "./query-editor/interfaces";
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
  const [queryState, setQueryState] = useState<QueryState>();
  useEffect(() => {
    if (queryState?.stage === Stage.QueryReady) {
      docManager.search(queryState.query, queryState.executionSettings);
      setQueryState(undefined);
    }
  }, [queryState, docManager]);
  if (queryState) {
    return <QueryEditor state={queryState} setState={setQueryState} />;
  }
  return (
    <DocUi
      docManager={docManager}
      state={docManagerState}
      codeDivRef={codeDivRef}
      onKeyPress={(ev, handleWithDocManager) => {
        if (mode === Mode.Normal && ev.key === "/") {
          ev.preventDefault();
          ev.stopPropagation();
          setQueryState({ stage: Stage.WriteDoc });
        } else {
          handleWithDocManager();
        }
      }}
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
