import React from "react";
import { useAutofocus } from "../../hooks/use-autofocus";
import { useDocManager } from "../../hooks/use-doc-manager";
import { Mode } from "../../logic/doc-manager";
import { emptyDoc } from "../../logic/doc-utils";
import { DocUi } from "../doc-ui";
import { Stage, State, WriteDocState } from "./interfaces";

interface Props {
  state: WriteDocState;
  setState: (state: State) => void;
}

export const WriteDocEditor = ({ state: _state, setState }: Props) => {
  const [codeDivRef] = useAutofocus<HTMLDivElement>();
  const [docManager, docManagerState] = useDocManager(emptyDoc, false);
  const { doc, mode } = docManagerState;
  return (
    <DocUi
      docManager={docManager}
      state={docManagerState}
      codeDivRef={codeDivRef}
      onKeyDown={(ev, handleWithDocManager) => {
        if (mode === Mode.Normal && ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          setState({ stage: Stage.SelectTargetRough, doc });
        } else {
          handleWithDocManager();
        }
      }}
    />
  );
};
