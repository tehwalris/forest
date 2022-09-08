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
  const taskPaths = new Map<string, string>();
  if (fsChoice.type !== "demo") {
    for (const subdirName of ["creation", "editing"]) {
      const subdirPath = path.join(
        fsChoice.projectRootDir,
        "tasks",
        subdirName,
      );
      for (const taskFilename of await promisify(fsChoice.fs.readdir)(
        subdirPath,
      )) {
        if (!taskFilename.endsWith(".ts")) {
          continue;
        }
        const taskPath = path.join(subdirPath, taskFilename);
        if (!isExplicitBeforePath(taskPath)) {
          taskPaths.set(taskPath, taskNameFromPath(taskPath));
        }
      }
    }
  }
  for (const example of examples) {
    taskPaths.set(
      path.join(
        fsChoice.projectRootDir,
        "tasks/editing",
        ...example.nameParts.slice(0, -1),
        example.nameParts[example.nameParts.length - 1] + ".after.ts",
      ),
      example.nameParts.join("/"),
    );
  }
  const loadText = (path: string): Promise<string> =>
    promisify(fsChoice.fs.readFile)(path, { encoding: "utf8" });
  return await Promise.all(
    [...taskPaths].map(async ([afterPath, name]) => {
      const contentAfter = await loadText(afterPath);
      let contentBefore = "";
      if (isExplicitAfterPath(afterPath)) {
        contentBefore = await loadText(beforePathFromAfterPath(afterPath));
      }
      return {
        name,
        afterPath,
        contentBefore,
        contentAfter,
      };
    }),
  );
}
