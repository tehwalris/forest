import * as path from "path";
import { join as pathJoin } from "path";
import { sortBy } from "ramda";
import { useEffect, useState } from "react";
import { promisify } from "util";
import { ChosenFs, Fs } from "../logic/tasks/fs";
interface Props {
  fsChoice: ChosenFs;
  onSelect: (file: FileWithPath) => void;
}
interface FileWithPath {
  text: string;
  path: string;
}
async function getAllPaths(fs: Fs, root: string): Promise<string[]> {
  const entries = await promisify(fs.readdir)(root);
  const files = await Promise.all(
    entries.map(async (fileName) => {
      const fullPath = pathJoin(root, fileName);
      const stats = await promisify(fs.stat)(fullPath);
      return stats.isDirectory() ? getAllPaths(fs, fullPath) : [fullPath];
    }),
  );
  return files.flat();
}
export const FileSearch = ({ fsChoice, onSelect }: Props) => {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    getAllPaths(fsChoice.fs, path.join(fsChoice.projectRootDir, "src"))
      .then((paths) =>
        setPaths(
          sortBy(
            (v) => v,
            paths.filter((p) => p.match(/\.tsx?$/)),
          ),
        ),
      )
      .catch((err) => console.error("getAllPaths failed", err));
  }, [fsChoice]);
  const [selectedPath, setSelectedPath] = useState("");
  useEffect(() => {
    if (!selectedPath) {
      return;
    }
    let didCancel = false;
    (async () => {
      const text = await promisify(fsChoice.fs.readFile)(selectedPath, {
        encoding: "utf8",
      });
      if (!didCancel) {
        onSelect({ path: selectedPath, text });
      }
    })().catch((err) =>
      console.error("failed to load file", selectedPath, err),
    );
    return () => {
      didCancel = true;
    };
  }, [selectedPath, onSelect, fsChoice.fs]);
  return (
    <select
      value={selectedPath}
      onChange={(ev) => setSelectedPath(ev.target.value)}
    >
      <option value="">Select real file...</option>
      {paths.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
};
