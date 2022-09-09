import { css } from "@emotion/css";
import { sortBy } from "ramda";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import { FileSearch } from "./components/file-search";
import { LinearEditor } from "./components/linear-editor";
import { RepoSwitcher } from "./components/repo-switcher";
import { eventsFromEventCreator } from "./examples/keys";
import { DocManager } from "./logic/doc-manager";
import { Doc } from "./logic/interfaces";
import { docFromAst } from "./logic/node-from-ts";
import { astFromTypescriptFileContent } from "./logic/parse";
import { defaultPrettierOptions, prettyPrintTsString } from "./logic/print";
import { ChosenFs, configureFs } from "./logic/tasks/fs";
import { Task } from "./logic/tasks/interfaces";
import { loadTasks } from "./logic/tasks/load";
import { isBrowseTask, isCreationTask } from "./logic/tasks/util";
const exampleFileText = `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else if (walrus) {
          console.log("even better");
        }
`;
const styles = {
  outerWrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,
  contentWrapper: css`
    flex: 1 1 100px;
    overflow: hidden;
  `,
  splitView: css`
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    & > div {
      width: 50%;
    }
  `,
  afterDoc: css`
    overflow: auto scroll;
    margin: 5px;
    white-space: pre;
    opacity: 0.5;
  `,
};
export const App = () => {
  const [fsChoice, setFsChoice] = useState<ChosenFs>();
  useEffect(() => {
    (async () => {
      const _fs = await configureFs(
        false,
        undefined,
        window.location.hash === "#demo",
      );
      setFsChoice(_fs);
    })().catch((err) => console.error("failed to configure remote fs", err));
  }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!fsChoice) {
      return;
    }
    (async () => {
      const tasks = await loadTasks(fsChoice);
      setTasks(
        sortBy(
          (t) =>
            `${isBrowseTask(t) ? "3" : isCreationTask(t) ? "2" : "1"}:${
              t.name
            }`,
          tasks,
        ),
      );
    })().catch((err) => console.error("failed to load tasks", err));
  }, [fsChoice]);
  const [initialDocInfo, setInitialDocInfo] = useState<{
    path?: string;
    text: string;
    initDocManager?: (docManager: DocManager) => void;
  }>({ text: exampleFileText });
  const initialDoc = useMemo(
    () =>
      docFromAst(
        astFromTypescriptFileContent(
          prettyPrintTsString(initialDocInfo.text, defaultPrettierOptions),
        ),
      ),
    [initialDocInfo],
  );
  const [_selectedTaskName, setSelectedTaskName] = useState("");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.name === _selectedTaskName),
    [tasks, _selectedTaskName],
  );
  useEffect(() => {
    if (selectedTask) {
      setInitialDocInfo({
        text: selectedTask.contentBefore,
        initDocManager:
          selectedTask.example &&
          ((docManager) => {
            const events = selectedTask
              .example!.describedGroups.flatMap((g) => g.eventCreators)
              .flatMap((c) => eventsFromEventCreator(c));

            docManager.forceUpdate();
            for (const eventOrFunction of events) {
              if (typeof eventOrFunction === "function") {
                eventOrFunction(docManager);
              } else {
                const { handler, event } = eventOrFunction;
                docManager[handler](event);
              }
            }
          }),
      });
    } else {
      setInitialDocInfo({ text: exampleFileText });
    }
  }, [selectedTask]);
  const prettySelectedTaskContentAfter = useMemo(() => {
    if (!selectedTask) {
      return undefined;
    }
    try {
      return prettyPrintTsString(
        selectedTask.contentAfter,
        defaultPrettierOptions,
      );
    } catch (err) {
      console.warn("failed to pretty print selectedTask.contentAfter", err);
      return selectedTask.contentAfter;
    }
  }, [selectedTask]);
  const [showTargetView, setShowTargetView] = useState(false);
  if (!fsChoice) {
    return <div>Connecting to remote filesystem...</div>;
  }
  const editor = (
    <LinearEditor
      initialDoc={initialDoc}
      initDocManager={initialDocInfo.initDocManager}
      onSave={(doc: Doc) =>
        (async () => {
          if (!initialDocInfo.path) {
            console.warn("open file has no save path");
            return;
          }
          await promisify(fsChoice.fs.writeFile)(
            initialDocInfo.path,
            doc.text,
            {
              encoding: "utf8",
            },
          );
        })().catch((err) => console.warn("failed to save file", err))
      }
    />
  );
  return (
    <div className={styles.outerWrapper}>
      <div>
        <RepoSwitcher fsChoice={fsChoice} />
      </div>
      {!fsChoice.probablyEmpty && (
        <div>
          Examples from{" "}
          <a href="https://doi.org/10.3929/ethz-b-000526812">thesis</a>:{" "}
          <select
            value={selectedTask?.name || ""}
            onChange={(ev) => setSelectedTaskName(ev.target.value)}
          >
            <option key="" value="">
              Select example...
            </option>
            {tasks.map((t) => (
              <option key={t.name} value={t.name}>
                {isBrowseTask(t) ? "b" : isCreationTask(t) ? "c" : "e"}:{t.name}
              </option>
            ))}
          </select>
          <button onClick={() => setShowTargetView((v) => !v)}>
            Toggle target view
          </button>
        </div>
      )}
      {!fsChoice.probablyEmpty && (
        <div>
          Real files:{" "}
          <FileSearch fsChoice={fsChoice} onSelect={setInitialDocInfo} />
        </div>
      )}
      <div className={styles.contentWrapper}>
        {showTargetView ? (
          <div className={styles.splitView}>
            {editor}
            <div className={styles.afterDoc}>
              {prettySelectedTaskContentAfter}
            </div>
          </div>
        ) : (
          editor
        )}
      </div>
    </div>
  );
};
