import * as React from "react";
import { useState } from "react";
import { ChosenFs, configureFs } from "../logic/tasks/fs";

interface Props {
  fsChoice: ChosenFs;
}

export const RepoSwitcher = ({ fsChoice }: Props) => {
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
      <button
        tabIndex={-1}
        onClick={() => switchRepo("https://github.com/tehwalris/forest")}
      >
        Load Forest repo
      </button>
      <button
        tabIndex={-1}
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
  return (
    <div>
      Using{fsChoice.probablyEmpty ? " empty" : ""} demo filesystem{" "}
      {extraContent}
    </div>
  );
};
