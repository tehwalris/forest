import {
  Box,
  Button,
  Code,
  Divider,
  Group,
  ScrollArea,
  Text,
} from "@mantine/core";
import React, { Fragment, ReactChild, useEffect, useRef } from "react";
import { EventCreator, EventCreatorKind } from "../examples/interfaces";
import { splitEventCreator } from "../examples/keys";
import {
  DocManagerCommand,
  hasCtrlLike,
  MinimalKeyboardEvent,
} from "../logic/doc-manager";
import { unreachable } from "../logic/util";
import { EventCreatorDisplay } from "./event-creator-display";

export interface Props {
  commandHistory: CommandHistoryEntry[];
  onClear: () => void;
}

export type CommandHistoryEntry = {
  event: MinimalKeyboardEvent;
  command?: DocManagerCommand;
};

interface DescribedEventCreator {
  eventCreator: EventCreator;
  description?: ReactChild;
  partOfChord?: boolean;
}

function keysFromEvent(originalEvent: MinimalKeyboardEvent): string {
  const ev = { ...originalEvent };
  if (ev.key.toUpperCase() === ev.key.toLowerCase()) {
    ev.shiftKey = false;
  }
  if (ev.key === " ") {
    ev.key = "space";
  }

  return [
    hasCtrlLike(ev) && "ctrl",
    ev.shiftKey && "shift",
    ev.altKey && "alt",
    ev.key.toLowerCase(),
  ]
    .filter((v) => v)
    .join("-");
}

export function describeCommand(
  command: DocManagerCommand,
  key: string,
): ReactChild {
  const keyIsDelimiter = "()[]{}<>".split("").includes(key);
  switch (command) {
    case DocManagerCommand.TextInput:
      return "Type";
    case DocManagerCommand.StartChord:
      return "Start chord";
    case DocManagerCommand.ExitInsertMode:
      return "Exit insert mode";
    case DocManagerCommand.MoveToParent:
      return "Move to parent";
    case DocManagerCommand.MoveToPreviousLeaf:
      return "Move to previous leaf node";
    case DocManagerCommand.MoveToNextLeaf:
      return "Move to next leaf node";
    case DocManagerCommand.ExtendUntilPreviousLeaf:
      return "Extend selection to previous leaf node";
    case DocManagerCommand.ExtendUntilNextLeaf:
      return "Extend selection to next leaf node";
    case DocManagerCommand.ReduceToJustExtended:
      return "Reduce selection to element just added by extend";
    case DocManagerCommand.ReduceToFirst:
      return "Reduce selection to first element";
    case DocManagerCommand.ReduceToLast:
      return "Reduce selection to last element";
    case DocManagerCommand.SelectInsideDelimitedList:
      if (keyIsDelimiter) {
        return (
          <>
            Select contents of first list delimited by <Code>{key}</Code>{" "}
            (descendant of current selection)
          </>
        );
      } else {
        return "Select contents of first list delimited by any matching pair (descendant of current selection)";
      }
    case DocManagerCommand.SelectOutsideDelimitedList:
      if (keyIsDelimiter) {
        return (
          <>
            Select closest list delimited by <Code>{key}</Code> (ancestor of
            current selection)
          </>
        );
      } else {
        return "Select closest list delimited by any matching pair (ancestor of current selection)";
      }
    case DocManagerCommand.UndoSelectionChange:
      return "Undo selection change";
    case DocManagerCommand.RedoSelectionChange:
      return "Redo selection change";
    case DocManagerCommand.RemoveLastElementFromSelection:
      return "Remove last element from selection";
    case DocManagerCommand.RemoveFirstElementFromSelection:
      return "Remove first element from selection";
    case DocManagerCommand.InsertTextBeforeCursor:
      return "Insert text before cursor";
    case DocManagerCommand.InsertTextAfterCursor:
      return "Insert text after cursor";
    case DocManagerCommand.DeleteSelectedNode:
      return "Delete selected nodes";
    case DocManagerCommand.Copy:
      return "Copy";
    case DocManagerCommand.Paste:
      return "Paste";
    case DocManagerCommand.SplitCursor:
      return "Split cursor by creating cursors for each selected list item";
    case DocManagerCommand.QueueSelection:
      return "Queue selection to later create a cursor with";
    case DocManagerCommand.CreateCursorsFromQueued:
      return "Create cursors from each queued selection (replaces existing cursor)";
    case DocManagerCommand.RemoveCursorsExceptFirst:
      return "Remove all cursors except the first one";
    case DocManagerCommand.RemoveCursorsExceptLast:
      return "Remove all cursors except the last one";
    case DocManagerCommand.RemoveCursorsExceptOutermost:
      return "Remove all cursors except the outermost one";
    case DocManagerCommand.RemoveCursorsExceptInnermost:
      return "Remove all cursors except the innermost one";
    case DocManagerCommand.RemoveOverlappingCursors:
      return "Remove overlapping cursors";
    case DocManagerCommand.SetMark:
      return (
        <>
          Save current selection as mark <Code>{key}</Code>
        </>
      );
    case DocManagerCommand.JumpToMark:
      return (
        <>
          Jump to selection that was saved as mark <Code>{key}</Code>
        </>
      );
    case DocManagerCommand.RenameUsingJavaScript:
      return "Rename all selected identifiers using JavaScript expression";
    case DocManagerCommand.OpenStructuralSearch:
      return "Open structural search";
    case DocManagerCommand.ChangeMultiCursorMode:
      const modesByKey: { [key: string]: string | undefined } = {
        r: "relaxed",
        d: "drop",
        s: "strict",
      };
      const mode = modesByKey[key];
      return `Change multi-cursor mode${mode ? ` to ${mode}` : ""}`;
    case DocManagerCommand.HandleFailure:
      if (key === "i") {
        return "Ignore failure (keep current state and cursors)";
      }
      const keepByKey: { [key: string]: string | undefined } = {
        s: "successful",
        f: "failed",
        a: "all",
      };
      const keep = keepByKey[key];
      return `Restore state before failure${
        keep ? ` and keep ${keep} cursors (branching)` : ""
      }`;
    default:
      return unreachable(command);
  }
}

function eventCreatorsFromCommandHistory(
  commandHistory: CommandHistoryEntry[],
): DescribedEventCreator[] {
  const describedEventCreators: DescribedEventCreator[] = [];

  let i = 0;
  const peek = () =>
    i < commandHistory.length ? commandHistory[i] : undefined;
  const take = () => {
    const entry = commandHistory[i];
    if (!entry) {
      throw new Error("out of range");
    }
    i++;
    return entry;
  };

  while (peek()) {
    const entry = take();
    if (entry.command === undefined) {
      continue;
    } else if (entry.command === DocManagerCommand.StartChord) {
      if (peek() && peek()?.command === undefined) {
        continue;
      } else if (peek()) {
        const finishChordEntry = take();
        describedEventCreators.push({
          eventCreator: {
            kind: EventCreatorKind.FromKeys,
            keys: [entry.event, finishChordEntry.event]
              .map((ev) => keysFromEvent(ev))
              .join(" "),
          },
          description: describeCommand(
            finishChordEntry.command!,
            finishChordEntry.event.key,
          ),
          partOfChord: true,
        });
      } else {
        describedEventCreators.push({
          eventCreator: {
            kind: EventCreatorKind.FromKeys,
            keys: keysFromEvent(entry.event),
          },
          description: describeCommand(entry.command, entry.event.key),
          partOfChord: true,
        });
      }
    } else if (entry.command === DocManagerCommand.TextInput) {
      const textEntries = [entry];
      while (true) {
        if (peek() && peek()?.command === undefined) {
          take();
        } else if (peek() && peek()?.command === DocManagerCommand.TextInput) {
          textEntries.push(take());
        } else {
          break;
        }
      }
      const letters: string[] = [];
      for (const entry of textEntries) {
        if (entry.event.key === "Backspace") {
          letters.pop();
        } else {
          letters.push(entry.event.key);
        }
      }
      if (letters.length) {
        describedEventCreators.push({
          eventCreator: {
            kind: EventCreatorKind.ToTypeString,
            string: letters.join(""),
          },
        });
      }
    } else {
      describedEventCreators.push({
        eventCreator: {
          kind: EventCreatorKind.FromKeys,
          keys: keysFromEvent(entry.event),
        },
        description: describeCommand(entry.command, entry.event.key),
      });
    }
  }

  return describedEventCreators;
}

export const CommandHistory = ({ commandHistory, onClear }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollArea = wrapperRef.current?.querySelector(
      ".mantine-ScrollArea-viewport",
    );
    if (scrollArea) {
      scrollArea.scrollTo(0, scrollArea.scrollHeight);
    }
  }, [commandHistory]);

  const displayedEventCreators = eventCreatorsFromCommandHistory(
    commandHistory.slice(-150),
  ).slice(-50);

  return (
    <div ref={wrapperRef} style={{ height: "100%", overflow: "hidden" }}>
      <ScrollArea style={{ height: "100%", width: "100%" }}>
        <Box
          sx={(theme) => ({
            padding: `${theme.spacing.md - theme.spacing.xs}px 0`,
          })}
        >
          {[
            displayedEventCreators.map(
              ({ eventCreator, description, partOfChord }, i) => (
                <Fragment key={i}>
                  {i > 0 && <Divider />}
                  <Group px="md" py="xs" style={{ display: "inline-flex" }}>
                    {splitEventCreator(eventCreator).map((part, iPart) => (
                      <EventCreatorDisplay
                        key={iPart}
                        eventCreator={part}
                        partOfChord={partOfChord}
                      />
                    ))}
                    <Text inline>{description}</Text>
                  </Group>
                </Fragment>
              ),
            ),
          ]}
        </Box>
        <Group position="center" my="md">
          <Button
            disabled={!displayedEventCreators.length}
            onClick={onClear}
            variant="light"
          >
            Clear command log
          </Button>
        </Group>
      </ScrollArea>
    </div>
  );
};
