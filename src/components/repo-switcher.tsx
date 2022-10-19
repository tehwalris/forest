import { Badge, Group } from "@mantine/core";
import * as React from "react";
import { ChosenFs } from "../logic/tasks/fs";

interface Props {
  fsChoice: ChosenFs;
}

export const RepoSwitcher = ({ fsChoice }: Props) => {
  if (fsChoice.type === "remote") {
    return (
      <Group position="center">
        <Badge color="green">Remote filesystem</Badge>
      </Group>
    );
  }
  return null;
};
