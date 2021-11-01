import { sortBy } from "ramda";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { LinearEditor } from "./components/linear-editor";
import { docFromAst } from "./logic/node-from-ts";
import { astFromTypescriptFileContent } from "./logic/parse";
import { configureRemoteFs } from "./logic/tasks/fs";
import { Task } from "./logic/tasks/interfaces";
import { loadTasks } from "./logic/tasks/load";
import { isCreationTask } from "./logic/tasks/util";

const exampleFileText = `
  export const handlers: {
    [key: string]: (() => void) | undefined;
  } = {
    Enter: node.actions.setVariant
      ? tryAction("setVariant", (n) => n.id, true)
      : tryAction("setFromString"),
    "ctrl-d": tryDeleteChild,
    "ctrl-c": () => copyNode(node),
    "ctrl-p": copiedNode && tryAction("replace", (n) => n.id),
    "ctrl-f": editFlags,
    "ctrl-4": () =>
      setMarks({
        ...marks,
        TODO: idPathFromParentIndexEntry(parentIndexEntry),
      }),
  };
`;

export const App = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    (async () => {
      const fs = await configureRemoteFs();
      const tasks = await loadTasks(fs);
      setTasks(
        sortBy((t) => `${isCreationTask(t) ? "2" : "1"}:${t.name}`, tasks),
      );
    })().catch((err) => console.error("failed to load tasks", err));
  }, []);

  const [initialDocText, setInitialDocText] = useState(exampleFileText);
  const initialDoc = useMemo(
    () => docFromAst(astFromTypescriptFileContent(initialDocText)),
    [initialDocText],
  );

  const [_selectedTaskName, setSelectedTaskName] = useState("");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.name === _selectedTaskName),
    [tasks, _selectedTaskName],
  );
  useEffect(() => {
    if (selectedTask) {
      setInitialDocText(selectedTask.contentBefore);
    } else {
      setInitialDocText(exampleFileText);
    }
  }, [selectedTask]);

  return (
    <>
      <select
        value={selectedTask?.name || ""}
        onChange={(ev) => setSelectedTaskName(ev.target.value)}
      >
        <option key="" value="">
          -
        </option>
        {tasks.map((t) => (
          <option key={t.name} value={t.name}>
            {isCreationTask(t) ? "c" : "e"}:{t.name}
          </option>
        ))}
      </select>
      <LinearEditor initialDoc={initialDoc} />
    </>
  );
};
