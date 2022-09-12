import { Alert, Badge, Group, Loader, Text } from "@mantine/core";
import * as React from "react";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    if (fsChoice.type === "demo" && fsChoice.probablyEmpty) {
      switchRepo("https://github.com/tehwalris/forest");
    }
  }, [fsChoice.type, fsChoice.probablyEmpty]);
  if (cloneState === "working") {
    return (
      <Group position="center">
        <Loader />
        <Text>Loading examples</Text>
      </Group>
    );
  }
  if (cloneState === "failed") {
    return (
      <Alert color="red" title="Failed to load examples">
        Try reloading the page. See the developer console for more information.
      </Alert>
    );
  }
  if (fsChoice.type === "remote") {
    return (
      <Group position="center">
        <Badge color="green">Remote filesystem</Badge>
      </Group>
    );
  }
  return null;
};
