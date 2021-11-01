import * as path from "path";
import { CreationTask, Task } from "./interfaces";

export function isCreationTask(task: Task): task is CreationTask {
  return task.contentBefore === "";
}

export function isExplicitBeforePath(p: string): boolean {
  return !!p.match(/\.before\.tsx?$/);
}

export function isExplicitAfterPath(p: string): boolean {
  return !!p.match(/\.after\.tsx?$/);
}

export function beforePathFromAfterPath(afterPath: string): string {
  const m = afterPath.match(/^(.*)\.after\.(tsx?)$/);
  if (!m) {
    throw new Error("isExplicitAfterPath(afterPath) is not satisfied");
  }
  return `${m[1]}.before.${m[2]}`;
}

export function taskNameFromPath(p: string): string {
  const filename = path.basename(p);
  const m = filename.match(/^([a-z-]+)(?:\.before|\.after)?\.tsx?$/);
  if (!m) {
    throw new Error("invalid filename format");
  }
  return m[1];
}
