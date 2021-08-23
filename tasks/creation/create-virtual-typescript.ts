type System = any;
type TS = any;
type CompilerOptions = any;
type CustomTransformers = any;
type VirtualTypeScriptEnvironment = any;

var defaultCompilerOptions,
  createVirtualLanguageServiceHost,
  createVirtualCompilerHost: any;

export function createVirtualTypeScriptEnvironment(
  sys: System,
  rootFiles: string[],
  ts: TS,
  compilerOptions: CompilerOptions = {},
  customTransformers?: CustomTransformers,
): VirtualTypeScriptEnvironment {
  const mergedCompilerOpts = {
    ...defaultCompilerOptions(ts),
    ...compilerOptions,
  };

  const { languageServiceHost, updateFile } = createVirtualLanguageServiceHost(
    sys,
    rootFiles,
    mergedCompilerOpts,
    ts,
    customTransformers,
  );
  const languageService = ts.createLanguageService(languageServiceHost);
  const diagnostics = languageService.getCompilerOptionsDiagnostics();

  if (diagnostics.length) {
    const compilerHost = createVirtualCompilerHost(sys, compilerOptions, ts);
    throw new Error(
      ts.formatDiagnostics(diagnostics, compilerHost.compilerHost),
    );
  }

  return {
    // @ts-ignore
    name: "vfs",
    sys,
    languageService,
    getSourceFile: (fileName) =>
      languageService.getProgram()?.getSourceFile(fileName),

    createFile: (fileName, content) => {
      updateFile(
        ts.createSourceFile(
          fileName,
          content,
          mergedCompilerOpts.target!,
          false,
        ),
      );
    },
    updateFile: (fileName, content, optPrevTextSpan) => {
      const prevSourceFile = languageService
        .getProgram()!
        .getSourceFile(fileName);
      if (!prevSourceFile) {
        throw new Error("Did not find a source file for " + fileName);
      }
      const prevFullContents = prevSourceFile.text;

      // TODO: Validate if the default text span has a fencepost error?
      const prevTextSpan =
        optPrevTextSpan ?? ts.createTextSpan(0, prevFullContents.length);
      const newText =
        prevFullContents.slice(0, prevTextSpan.start) +
        content +
        prevFullContents.slice(prevTextSpan.start + prevTextSpan.length);
      const newSourceFile = ts.updateSourceFile(prevSourceFile, newText, {
        span: prevTextSpan,
        newLength: content.length,
      });

      updateFile(newSourceFile);
    },
  };
}
