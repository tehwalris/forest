import * as path from "path";
import { promisify } from "util";
import { examples } from "../../examples/examples";
import { ChosenFs } from "./fs";
import { Task } from "./interfaces";
export async function loadTasks(fsChoice: ChosenFs): Promise<Task[]> {
  const loadText = (path: string): Promise<string> =>
    promisify(fsChoice.fs.readFile)(path, { encoding: "utf8" });
  return await Promise.all(
    examples.map(async (example): Promise<Task> => {
      const beforePath = path.join(
        fsChoice.projectRootDir,
        "tasks/editing",
        ...example.nameParts.slice(0, -1),
        example.nameParts[example.nameParts.length - 1] + ".before.ts",
      );
      const contentBefore = await loadText(beforePath);
      return { key: JSON.stringify(example.nameParts), example, contentBefore };
    }),
  );
}
