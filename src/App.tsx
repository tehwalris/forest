import * as React from "react";
import { useEffect, useState } from "react";
import { Editor } from "./components/editor";
import { ChosenFs, configureFs } from "./logic/fs";
import { RepoSwitcher } from "./components/repo-switcher";

export const App = () => {
  const [fsChoice, setFsChoice] = useState<ChosenFs>();
  useEffect(() => {
    configureFs(false).then(c => setFsChoice(c));
  }, []);
  if (!fsChoice) {
    return null;
  }
  return (
    <>
      <Editor fs={fsChoice.fs} projectRootDir={fsChoice.projectRootDir} />
      <RepoSwitcher fsChoice={fsChoice} />
      <div>
        <a
          href="https://github.com/tehwalris/forest"
          target="_blank"
          rel="noopener noreferrer"
        >
          Documentation
        </a>
      </div>
    </>
  );
};
