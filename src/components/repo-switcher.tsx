import * as React from "react";
import { ChosenFs, configureFs } from "../logic/fs";
import { useState } from "react";

interface Props {
  fsChoice: ChosenFs;
}

export const RepoSwitcher: React.FC<Props> = ({ fsChoice }) => {
  const [cloneState, setCloneState] = useState<"idle" | "working" | "failed">(
    "idle",
  );
  async function switchRepo(cloneUrl: string | undefined) {
    setCloneState("working");
    try {
      await configureFs(true, cloneUrl);
      setTimeout(() => {
        // HACK Saving in lightning-fs is debounced. Wait for it to finish before reloading.
        window.onbeforeunload = null;
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error(err);
      setCloneState("failed");
    }
  }
  if (fsChoice.type === "remote") {
    return <div>Using remote filesystem</div>;
  }
  let extraContent = (
    <>
      <button onClick={() => switchRepo(undefined)}>Load empty</button>
      <button onClick={() => switchRepo("https://github.com/tehwalris/forest")}>
        Load Forest repo
      </button>
      <button
        onClick={() => switchRepo("https://github.com/tehwalris/divetree")}
      >
        Load divetree repo
      </button>
      <button
        onClick={() => {
          const url = prompt(
            "Enter a git repo URL",
            "https://github.com/tehwalris/forest",
          );
          if (url) {
            switchRepo(url);
          }
        }}
      >
        Load custom repo
      </button>
    </>
  );
  if (cloneState === "working") {
    extraContent = <b>(switching repo...)</b>;
  }
  if (cloneState === "failed") {
    extraContent = (
      <>
        <b>(clone failed, see console)</b> {extraContent}
      </>
    );
  }
  return <div>Using demo filesystem {extraContent}</div>;
};
