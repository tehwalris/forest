import { join as pathJoin } from "path";
import { sortBy } from "ramda";
import { useEffect, useState } from "react";
import { promisify } from "util";
import { Fs } from "../logic/tasks/fs";

interface Props {
  fs: Fs;
  onSelect: (file: FileWithPath) => void;
}

interface FileWithPath {
  text: string;
  path: string;
}

// based on https://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
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

export const FileSearch = ({ fs, onSelect }: Props) => {
  const [paths, setPaths] = useState<string[]>([]);
  useEffect(() => {
    getAllPaths(fs, "src")
      .then((paths) =>
        setPaths(
          sortBy(
            (v) => v,
            paths.filter((p) => p.match(/\.tsx?$/)),
          ),
        ),
      )
      .catch((err) => console.error("getAllPaths failed", err));
  }, [fs]);

  const [selectedPath, setSelectedPath] = useState("");
  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    let didCancel = false;
    (async () => {
      const text = await promisify(fs.readFile)(selectedPath, {
        encoding: "utf-8",
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
  }, [selectedPath, onSelect, fs]);

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
