import { css } from "@emotion/css";
import React, { useMemo } from "react";
import { useAutofocus } from "../../hooks/use-autofocus";
import { useDocManager } from "../../hooks/use-doc-manager";
import { Mode } from "../../logic/doc-manager";
import {
  getEquivalentNodes,
  isFocusOnEmptyListContent,
  normalizeFocusOut,
} from "../../logic/focus";
import { NodeWithPath, Path } from "../../logic/interfaces";
import { makeExactMatchQuery } from "../../logic/search/exact";
import { nodeGetByPath } from "../../logic/tree-utils/access";
import { DocUi } from "../doc-ui";
import { ConfigureState, Stage, State } from "./interfaces";

interface Props {
  state: ConfigureState;
  setState: (state: State) => void;
}

const styles = {
  outerWrapper: css`
    display: flex;
    height: 100%;
  `,
  docWrapper: css`
    flex: 3 1 300px;
  `,
  configureWrapper: css`
    flex: 1 1 300px;
  `,
};

export const ConfigureEditor = ({
  state: { doc, target: searchRootPath },
  setState,
}: Props) => {
  const [codeDivRef] = useAutofocus<HTMLDivElement>();
  const [docManager, docManagerState] = useDocManager(doc, true);
  const { mode, cursors } = docManagerState;
  const focusedPath = useMemo<Path | undefined>(() => {
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
  const equivalentNodes: NodeWithPath[] = useMemo(() => {
    if (!focusedPath || !nodeGetByPath(doc.root, focusedPath)) {
      return [];
    }
    return getEquivalentNodes(doc.root, focusedPath);
  }, [doc, focusedPath]);
  return (
    <div className={styles.outerWrapper}>
      <div className={styles.docWrapper}>
        <DocUi
          docManager={docManager}
          state={docManagerState}
          codeDivRef={codeDivRef}
          onKeyDown={(ev, handleWithDocManager) => {
            if (mode === Mode.Normal && ev.key === "Enter") {
              ev.preventDefault();
              ev.stopPropagation();
              const searchRootNode = nodeGetByPath(doc.root, searchRootPath);
              if (!searchRootNode) {
                throw new Error("unreachable");
              }
              setState({
                stage: Stage.QueryReady,
                query: makeExactMatchQuery(searchRootNode),
              });
            } else {
              handleWithDocManager();
            }
          }}
        />
      </div>
      <div className={styles.configureWrapper}>{equivalentNodes.length}</div>
    </div>
  );
};
