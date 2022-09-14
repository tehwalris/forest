import * as React from "react";
import { useEffect, useState } from "react";
import { useAutofocus } from "../hooks/use-autofocus";
import { useDocManager } from "../hooks/use-doc-manager";
import {
  DocManager,
  DocManagerCommand,
  hasCtrlLike,
  MinimalKeyboardEvent,
  Mode,
} from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { DocUi } from "./doc-ui";
import { QueryEditor } from "./query-editor";
import { Stage, State as QueryState } from "./query-editor/interfaces";
interface Props {
  initialDoc: Doc;
  initDocManager?: (docManager: DocManager) => void;
  onSave: (doc: Doc) => void;
  onCommand?: (
    key: MinimalKeyboardEvent,
    command: DocManagerCommand | undefined,
  ) => void;
}
export const LinearEditor = ({
  initialDoc,
  initDocManager,
  onSave,
  onCommand,
}: Props) => {
  const [codeDivRef, focusCodeDiv] = useAutofocus<HTMLDivElement>();
  useEffect(() => {
    focusCodeDiv();
  }, [initialDoc, focusCodeDiv]);
  const [docManager, docManagerState] = useDocManager(
    initialDoc,
    false,
    initDocManager,
  );
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
      onKeyDown={(ev, handleWithDocManager) => {
        if (ev.key === "l" && ev.ctrlKey) {
          return;
        } else if (mode === Mode.Normal && ev.key === "/") {
          ev.preventDefault();
          ev.stopPropagation();
          setQueryState({ stage: Stage.WriteDoc });
        } else if (mode === Mode.Normal && ev.key === "s" && hasCtrlLike(ev)) {
          ev.preventDefault();
          ev.stopPropagation();
          onSave(doc);
        } else {
          handleWithDocManager();
        }
      }}
      onCommand={onCommand}
    />
  );
};
