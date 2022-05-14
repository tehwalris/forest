import * as path from "path";
import { promisify } from "util";
import { ChosenFs } from "./fs";
import { Task } from "./interfaces";
import {
  beforePathFromAfterPath,
  isExplicitAfterPath,
  isExplicitBeforePath,
  taskNameFromPath,
} from "./util";
export async function loadTasks(fsChoice: ChosenFs): Promise<Task[]> {
  const taskPaths: string[] = [];
  for (const subdirName of ["creation", "editing"]) {
    const subdirPath = path.join(fsChoice.projectRootDir, "tasks", subdirName);
    for (const taskFilename of await promisify(fsChoice.fs.readdir)(
      subdirPath,
    )) {
      const taskPath = path.join(subdirPath, taskFilename);
      if (!isExplicitBeforePath(taskPath)) {
        taskPaths.push(taskPath);
      }
    }
  }
  const loadText = (path: string): Promise<string> =>
    promisify(fsChoice.fs.readFile)(path, { encoding: "utf8" });
  return await Promise.all(
    taskPaths.map(async (afterPath) => {
      const contentAfter = await loadText(afterPath);
      let contentBefore = "";
      if (isExplicitAfterPath(afterPath)) {
        contentBefore = await loadText(beforePathFromAfterPath(afterPath));
      }
      return {
        name: taskNameFromPath(afterPath),
        afterPath,
        contentBefore,
        contentAfter,
      };
    }),
  );
}
