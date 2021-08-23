// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/src/index.ts

var audit, files, tsLib, nodeSys: any;

audit("readFile", (fileName) => {
  if (files.has(fileName)) return files.get(fileName);
  if (fileName.startsWith("/lib")) {
    const tsLibName = `${tsLib}/${fileName.replace("/", "")}`;
    const result = nodeSys.readFile(tsLibName);
    if (!result) {
      const libs = nodeSys.readDirectory(tsLib);
      throw new Error(
        "A request was made for " +
          tsLibName +
          " but no file was found in " +
          libs,
      );
    }
    return result;
  }
  return nodeSys.readFile(fileName);
});
