import * as React from "react";
import { LinearEditor } from "./components/linear-editor";
import { configureRemoteFs } from "./logic/tasks/fs";
import { loadTasks } from "./logic/tasks/load";

(async () => {
  const fs = await configureRemoteFs();
  const tasks = await loadTasks(fs);
  console.log("DEBUG tasks", tasks);
})().catch((err) => console.error(err));

export const App = () => <LinearEditor />;
