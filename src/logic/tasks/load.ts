import * as path from "path";
import { promisify } from "util";
import { examples } from "../../examples/examples";
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
  const exampleNames = new Set(examples.map((e) => e.name));
  for (const subdirName of ["creation", "editing"]) {
    const subdirPath = path.join(fsChoice.projectRootDir, "tasks", subdirName);
    for (const taskFilename of await promisify(fsChoice.fs.readdir)(
      subdirPath,
    )) {
      if (
        fsChoice.type === "demo" &&
        !exampleNames.has(taskFilename.split(".")[0])
      ) {
        continue;
      }
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
