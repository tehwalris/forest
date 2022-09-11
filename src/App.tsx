import { css } from "@emotion/css";
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
      setTasks(await loadTasks(fsChoice));
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
  const [_selectedTaskKey, setSelectedTaskKey] = useState("");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.key === _selectedTaskKey),
    [tasks, _selectedTaskKey],
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

            try {
              docManager.forceUpdate();
              for (const eventOrFunction of events) {
                if (typeof eventOrFunction === "function") {
                  eventOrFunction(docManager);
                } else {
                  const { handler, event } = eventOrFunction;
                  docManager[handler](event);
                }
              }
            } catch (err) {
              console.warn("failed to run example", err);
            }
          }),
      });
    } else {
      setInitialDocInfo({ text: exampleFileText });
    }
  }, [selectedTask]);
  if (!fsChoice) {
    return <div>Connecting to remote filesystem...</div>;
  }
  return (
    <div className={styles.outerWrapper}>
      <div>
        <RepoSwitcher fsChoice={fsChoice} />
      </div>
      {!fsChoice.probablyEmpty && (
        <div>
          Examples:{" "}
          <select
            value={selectedTask?.key || ""}
            onChange={(ev) => setSelectedTaskKey(ev.target.value)}
          >
            <option key="" value="">
              Select example...
            </option>
            {tasks.map((t) => (
              <option key={t.key} value={t.key}>
                {t.example.nameParts.join("/")}
              </option>
            ))}
          </select>
        </div>
      )}
      {!fsChoice.probablyEmpty && (
        <div>
          Real files:{" "}
          <FileSearch fsChoice={fsChoice} onSelect={setInitialDocInfo} />
        </div>
      )}
      <div className={styles.contentWrapper}>
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
      </div>
    </div>
  );
};
