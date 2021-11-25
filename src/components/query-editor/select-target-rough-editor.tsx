import React, { useMemo } from "react";
import { useDocManager } from "../../hooks/use-doc-manager";
import { Mode } from "../../logic/doc-manager";
import {
  isFocusOnEmptyListContent,
  normalizeFocusOut,
} from "../../logic/focus";
import { Path } from "../../logic/interfaces";
import { DocUi } from "../doc-ui";
import { SelectTargetRoughState, Stage, State } from "./interfaces";

interface Props {
  state: SelectTargetRoughState;
  setState: (state: State) => void;
}

export const SelectTargetRoughEditor = ({
  state: { doc },
  setState,
}: Props) => {
  const [docManager, docManagerState] = useDocManager(doc, true);
  const { mode, cursors } = docManagerState;
  const roughTarget = useMemo<Path | undefined>(() => {
    if (cursors.length !== 1) {
      return undefined;
    }
    let focus = cursors[0].focus;
    if (isFocusOnEmptyListContent(doc.root, focus)) {
      return undefined;
    }
    focus = normalizeFocusOut(doc.root, focus);
    if (focus.offset !== 0) {
      return undefined;
    }
    return focus.anchor;
  }, [doc, cursors]);
  return (
    <DocUi
      docManager={docManager}
      state={docManagerState}
      onKeyDown={(ev, handleWithDocManager) => {
        if (mode === Mode.Normal && ev.key === "s" && ev.ctrlKey) {
          ev.preventDefault();
          ev.stopPropagation();
          if (roughTarget) {
            setState({ stage: Stage.SelectTargetExact, doc, roughTarget });
          }
        } else {
          handleWithDocManager();
        }
      }}
    />
  );
};
