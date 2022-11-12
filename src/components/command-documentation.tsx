import { Divider, Group, ScrollArea, Stack, Title } from "@mantine/core";
import * as R from "ramda";
import React, { Fragment } from "react";
import { EventCreatorKind } from "../examples/interfaces";
import { splitEventCreator } from "../examples/keys";
import { DocManagerCommand } from "../logic/doc-manager";
import { describeCommand } from "./command-history";
import { EventCreatorDisplay } from "./event-creator-display";

interface DocumentedCommandGroup {
  title: string;
  commands: DocumentedCommand[];
}

interface DocumentedCommand {
  command: DocManagerCommand;
  keys: string[];
}

const documentedCommands: DocumentedCommandGroup[] = [
  {
    title: "Insertion and editing",
    commands: [
      {
        command: DocManagerCommand.InsertTextBeforeCursor,
        keys: ["i"],
      },
      {
        command: DocManagerCommand.InsertTextAfterCursor,
        keys: ["a"],
      },
      {
        command: DocManagerCommand.ExitInsertMode,
        keys: ["escape"],
      },
      {
        command: DocManagerCommand.DeleteSelectedNode,
        keys: ["d"],
      },
      {
        command: DocManagerCommand.Copy,
        keys: ["c"],
      },
      {
        command: DocManagerCommand.Paste,
        keys: ["p"],
      },
    ],
  },
  {
    title: "Cursor movement",
    commands: [
      {
        command: DocManagerCommand.MoveToParent,
        keys: ["k"],
      },
      {
        command: DocManagerCommand.MoveToPreviousLeaf,
        keys: ["h"],
      },
      {
        command: DocManagerCommand.MoveToNextLeaf,
        keys: ["l"],
      },
      {
        command: DocManagerCommand.UndoSelectionChange,
        keys: ["z"],
      },
      {
        command: DocManagerCommand.RedoSelectionChange,
        keys: ["shift-z"],
      },
    ],
  },
  {
    title: "Reducing and extending selection",
    commands: [
      {
        command: DocManagerCommand.ReduceToFirst,
        keys: ["alt-h"],
      },
      {
        command: DocManagerCommand.ReduceToLast,
        keys: ["alt-l"],
      },
      {
        command: DocManagerCommand.ExtendUntilPreviousLeaf,
        keys: ["shift-h"],
      },
      {
        command: DocManagerCommand.ExtendUntilNextLeaf,
        keys: ["shift-l"],
      },
      {
        command: DocManagerCommand.ReduceToJustExtended,
        keys: ["space"],
      },
      {
        command: DocManagerCommand.RemoveFirstElementFromSelection,
        keys: ["ctrl-shift-l"],
      },
      {
        command: DocManagerCommand.RemoveLastElementFromSelection,
        keys: ["ctrl-shift-h"],
      },
    ],
  },
  {
    title: "Navigating with delimiters",
    commands: [
      {
        command: DocManagerCommand.SelectInsideDelimitedList,
        keys: ["(", "[", "{", "<"],
      },
      {
        command: DocManagerCommand.SelectOutsideDelimitedList,
        keys: [")", "]", "}", ">"],
      },
    ],
  },
  {
    title: "Multi-cursor",
    commands: [
      {
        command: DocManagerCommand.SplitCursor,
        keys: ["s"],
      },
      {
        command: DocManagerCommand.QueueSelection,
        keys: ["q"],
      },
      {
        command: DocManagerCommand.CreateCursorsFromQueued,
        keys: ["shift-q"],
      },
      {
        command: DocManagerCommand.RemoveCursorsExceptFirst,
        keys: ["shift-s h"],
      },
      {
        command: DocManagerCommand.RemoveCursorsExceptLast,
        keys: ["shift-s l"],
      },
      {
        command: DocManagerCommand.RemoveCursorsExceptInnermost,
        keys: ["shift-s j"],
      },
      {
        command: DocManagerCommand.RemoveCursorsExceptOutermost,
        keys: ["shift-s k"],
      },
      {
        command: DocManagerCommand.RemoveOverlappingCursors,
        keys: ["shift-s f"],
      },
    ],
  },
  {
    title: "Marks",
    commands: [
      {
        command: DocManagerCommand.SetMark,
        keys: ["m a", "m b"],
      },
      {
        command: DocManagerCommand.JumpToMark,
        keys: ["shift-m a", "shift-m b"],
      },
    ],
  },
  {
    title: "Advanced",
    commands: [
      {
        command: DocManagerCommand.RenameUsingJavaScript,
        keys: ["r"],
      },
      {
        command: DocManagerCommand.OpenStructuralSearch,
        keys: ["/"],
      },
      {
        command: DocManagerCommand.ChangeMultiCursorMode,
        keys: ["y r", "y d", "y s"],
      },
      {
        command: DocManagerCommand.HandleFailure,
        keys: ["shift-y s", "shift-y f", "shift-y a", "shift-y i"],
      },
    ],
  },
];

const longestKeyCombo = "ctrl-shift-l";

const KeyComboDisplay = ({ keyCombo }: { keyCombo: string }) => {
  const parts = splitEventCreator({
    kind: EventCreatorKind.FromKeys,
    keys: keyCombo,
  });
  const partOfChord = parts.length > 1;
  return (
    <Group spacing="xs" style={{ display: "inline-flex" }}>
      {parts.map((part, iPart) => (
        <EventCreatorDisplay
          key={iPart}
          eventCreator={part}
          partOfChord={partOfChord}
        />
      ))}
    </Group>
  );
};

export const CommandDocumentation = React.memo(() => {
  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <ScrollArea style={{ height: "100%", width: "100%" }}>
        <Stack mb="xl">
          {documentedCommands.map((g) => (
            <Fragment key={g.title}>
              <Title order={4} align="center" mt="xl" mb="md">
                {g.title}
              </Title>
              <Stack key={g.title} spacing="xs">
                {g.commands.map(({ command, keys }, i) => (
                  <Fragment key={command}>
                    {i !== 0 && <Divider variant="dotted" />}
                    {keys.map((keyCombo) => (
                      <Group key={keyCombo} px="md" noWrap>
                        <Group style={{ position: "relative" }}>
                          <Group style={{ opacity: 0, pointerEvents: "none" }}>
                            <KeyComboDisplay keyCombo={longestKeyCombo} />
                          </Group>
                          <Group style={{ position: "absolute", right: 0 }}>
                            <KeyComboDisplay keyCombo={keyCombo} />
                          </Group>
                        </Group>
                        <div style={{ flexBasis: "100px", flexGrow: 1 }}>
                          {describeCommand(
                            command,
                            R.last(keyCombo.split(" "))!,
                          )}
                        </div>
                      </Group>
                    ))}
                  </Fragment>
                ))}
              </Stack>
            </Fragment>
          ))}
        </Stack>
      </ScrollArea>
    </div>
  );
});
