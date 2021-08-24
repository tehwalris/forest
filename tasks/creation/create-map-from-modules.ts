type CompilerOptions = any;
var requirePath: any;
var requireFS: any;
var knownLibFilesForCompilerOptions: any;

export const createDefaultMapFromNodeModules = (
  compilerOptions: CompilerOptions,
  ts?: typeof import("typescript"),
) => {
  const tsModule = ts || require("typescript");
  const path = requirePath();
  const fs = requireFS();

  const getLib = (name: string) => {
    const lib = path.dirname(require.resolve("typescript"));
    return fs.readFileSync(path.join(lib, name), "utf8");
  };

  const libs = knownLibFilesForCompilerOptions(compilerOptions, tsModule);
  const fsMap = new Map<string, string>();
  libs.forEach((lib) => {
    fsMap.set("/" + lib, getLib(lib));
  });
  return fsMap;
};
