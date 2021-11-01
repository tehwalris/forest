import * as path from "path";
import { promisify } from "util";
import { Fs } from "./fs";
import { Task } from "./interfaces";
import {
  beforePathFromAfterPath,
  isExplicitAfterPath,
  isExplicitBeforePath,
  taskNameFromPath,
} from "./util";

export async function loadTasks(fs: Fs): Promise<Task[]> {
  const taskPaths: string[] = [];
  for (const subdirName of ["creation", "editing"]) {
    const subdirPath = path.join("./tasks", subdirName);
    for (const taskFilename of await promisify(fs.readdir)(subdirPath)) {
      const taskPath = path.join(subdirPath, taskFilename);
      if (!isExplicitBeforePath(taskPath)) {
        taskPaths.push(taskPath);
      }
    }
  }

  const loadText = (path: string): Promise<string> =>
    promisify(fs.readFile)(path, { encoding: "utf-8" });

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
