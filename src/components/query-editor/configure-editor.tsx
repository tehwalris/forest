import { css } from "@emotion/css";
import React, { useEffect, useMemo, useRef } from "react";
import { useAutofocus } from "../../hooks/use-autofocus";
import { useDocManager } from "../../hooks/use-doc-manager";
import { useRenderTrigger } from "../../hooks/use-render-trigger";
import { Mode } from "../../logic/doc-manager";
import {
  getEquivalentNodes,
  isFocusOnEmptyListContent,
  normalizeFocusOut,
} from "../../logic/focus";
import { NodeWithPath, Path } from "../../logic/interfaces";
import { PathMap } from "../../logic/path-map";
import { getCommonPathPrefix, pathsAreEqual } from "../../logic/path-utils";
import { SearchSettings } from "../../logic/search/interfaces";
import {
  getDefaultStructuralSearchSettings,
  makeQueryFromSettings,
} from "../../logic/search/settings";
import { nodeGetByPath } from "../../logic/tree-utils/access";
import { DocUi } from "../doc-ui";
import { ConfigureState, Stage, State } from "./interfaces";
import { SettingsPanel } from "./settings-panel";

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

export const ConfigureEditor = ({ state, setState }: Props) => {
  const { doc, target: searchRootPath, executionSettings } = state;
  const [codeDivRef] = useAutofocus<HTMLDivElement>();
  const [docManager, docManagerState] = useDocManager(doc, true);
  const { mode, cursors } = docManagerState;
  const settingsMap = useRef(new PathMap<SearchSettings>()).current;
  const markSettingsChanged = useRenderTrigger();
  useEffect(() => settingsMap.clear(), [settingsMap, doc]);
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
              setState({
                stage: Stage.QueryReady,
                query: makeQueryFromSettings(
                  doc.root,
                  searchRootPath,
                  settingsMap.clone(),
                ),
                executionSettings,
              });
            } else {
              handleWithDocManager();
            }
          }}
        />
      </div>
      <div className={styles.configureWrapper}>
        {equivalentNodes.find(({ path }) =>
          pathsAreEqual(path, searchRootPath),
        ) && (
          <>
            <div>
              <div>Execution settings</div>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={executionSettings.shallowSearchForRoot}
                    onChange={(ev) =>
                      setState({
                        ...state,
                        executionSettings: {
                          ...executionSettings,
                          shallowSearchForRoot: ev.target.checked,
                        },
                      })
                    }
                  />
                  Check if selection matches query (do not search subtrees)
                </label>
              </div>
            </div>
            <hr />
          </>
        )}
        {equivalentNodes
          .filter(({ path }) =>
            pathsAreEqual(
              getCommonPathPrefix(path, searchRootPath),
              searchRootPath,
            ),
          )
          .map(({ node, path }, i) => (
            <React.Fragment key={i}>
              {i !== 0 && <hr />}
              <SettingsPanel
                node={node}
                settings={
                  settingsMap.get(path) ||
                  getDefaultStructuralSearchSettings(node)
                }
                setSettings={(s) => {
                  settingsMap.set(path, s);
                  markSettingsChanged();
                }}
              />
            </React.Fragment>
          ))}
      </div>
    </div>
  );
};
