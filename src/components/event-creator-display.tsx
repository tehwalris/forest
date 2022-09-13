import { Code, Group, Kbd, Text } from "@mantine/core";
import React from "react";
import { EventCreator, EventCreatorKind } from "../examples/interfaces";
import { splitEventCreator } from "../examples/keys";
import { unreachable } from "../logic/util";

interface Props {
  eventCreator: EventCreator;
  partOfChord?: boolean;
}

export const EventCreatorDisplay = ({ eventCreator, partOfChord }: Props) => {
  if (splitEventCreator(eventCreator).length !== 1) {
    console.warn(
      "EventCreatorDisplay should only be used with pre-split event creators",
    );
  }
  switch (eventCreator.kind) {
    case EventCreatorKind.FromKeys:
      return (
        <Kbd style={{ padding: "1px 5px 0 5px" }}>
          {eventCreator.keys
            .split("-")
            .map((s) => {
              if (partOfChord) {
                return s;
              }
              // HACK This is not always correct with cords
              const lookup: {
                [key: string]: string | undefined;
              } = { k: "↑", l: "→", j: "↓", h: "←" };
              return lookup[s] || s;
            })
            .map((s) => s && s[0].toUpperCase() + s.slice(1))
            .join(" + ")}
        </Kbd>
      );
    case EventCreatorKind.ToTypeString:
      return (
        <Group spacing={5} align="flex-end">
          <Text italic>Type</Text> <Code>{eventCreator.string}</Code>
        </Group>
      );
    case EventCreatorKind.Function:
      return <Text italic>{eventCreator.description}</Text>;
    default:
      return unreachable(eventCreator);
  }
};
