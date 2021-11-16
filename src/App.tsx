import { css } from "@emotion/css";
import { sortBy } from "ramda";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import { LinearEditor } from "./components/linear-editor";
import { Doc } from "./logic/interfaces";
import { docFromAst } from "./logic/node-from-ts";
import { astFromTypescriptFileContent } from "./logic/parse";
import { prettyPrintTsString } from "./logic/print";
import { configureRemoteFs, Fs } from "./logic/tasks/fs";
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
  splitView: css`
    display: flex;
    flex-direction: row;
    & > div {
      width: 50%;
      overflow: auto hidden;
    }
  `,
  afterDoc: css`
    margin: 5px;
    white-space: pre;
    opacity: 0.5;
  `,
};
export const App = () => {
  const [fs, setFs] = useState<Fs>();
  useEffect(() => {
    (async () => {
      const _fs = await configureRemoteFs();
      setFs(_fs);
    })().catch((err) => console.error("failed to configure remote fs", err));
  }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!fs) {
      return;
    }
    (async () => {
      const tasks = await loadTasks(fs);
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
  }, [fs]);
  const [initialDocInfo, setInitialDocInfo] = useState<{
    path?: string;
    text: string;
  }>({ text: exampleFileText });
  const initialDoc = useMemo(
    () =>
      docFromAst(
        astFromTypescriptFileContent(prettyPrintTsString(initialDocInfo.text)),
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
      setInitialDocInfo({ text: selectedTask.contentBefore });
    } else {
      setInitialDocInfo({ text: exampleFileText });
    }
  }, [selectedTask]);
  const prettySelectedTaskContentAfter = useMemo(() => {
    if (!selectedTask) {
      return undefined;
    }
    try {
      return prettyPrintTsString(selectedTask.contentAfter);
    } catch (err) {
      console.warn("failed to pretty print selectedTask.contentAfter", err);
      return selectedTask.contentAfter;
    }
  }, [selectedTask]);
  const [showTargetView, setShowTargetView] = useState(false);
  const editor = (
    <LinearEditor
      initialDoc={initialDoc}
      onSave={(doc: Doc) =>
        (async () => {
          if (!initialDocInfo.path) {
            console.warn("open file has no save path");
            return;
          }
          if (!fs) {
            throw new Error("no filesystem connected");
          }
          await promisify(fs.writeFile)(initialDocInfo.path, doc.text, {
            encoding: "utf-8",
          });
        })().catch((err) => console.warn("failed to save file", err))
      }
    />
  );
  return (
    <>
      <div>
        <select
          value={selectedTask?.name || ""}
          onChange={(ev) => setSelectedTaskName(ev.target.value)}
        >
          <option key="" value="">
            -
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
    </>
  );
};
