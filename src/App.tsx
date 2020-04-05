import * as React from "react";
import { useEffect, useState } from "react";
import { Editor } from "./components/editor";
import { ChosenFs, configureFs } from "./logic/fs";

export const App = () => {
  const [fsChoice, setFsChoice] = useState<ChosenFs>();
  useEffect(() => {
    configureFs(true, "https://github.com/tehwalris/divetree").then(c =>
      setFsChoice(c),
    );
  }, []);
  if (!fsChoice) {
    return null;
  }
  return <Editor fs={fsChoice.fs} projectRootDir={fsChoice.projectRootDir} />;
};
