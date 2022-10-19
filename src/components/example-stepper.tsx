import {
  ActionIcon,
  Box,
  Breadcrumbs,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  Timeline,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconRefresh,
} from "@tabler/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { EventCreatorKind } from "../examples/interfaces";
import { eventsFromEventCreator, splitEventCreator } from "../examples/keys";
import {
  DocManager,
  DocManagerCommand,
  DocManagerPublicState,
  initialDocManagerPublicState,
} from "../logic/doc-manager";
import { docFromAst } from "../logic/node-from-ts";
import { astFromTypescriptFileContent } from "../logic/parse";
import { defaultPrettierOptions, prettyPrintTsString } from "../logic/print";
import { Task } from "../logic/tasks/interfaces";
import { describeCommand } from "./command-history";
import { EventCreatorDisplay } from "./event-creator-display";

interface Props {
  task: Task;
  onStateChange: (state: DocManagerPublicState) => void;
}

export const ExampleStepper = ({
  task: originalTask,
  onStateChange,
}: Props) => {
  const task = useMemo(
    () => ({
      ...originalTask,
      example: {
        ...originalTask.example,
        describedGroups: originalTask.example.describedGroups.map(
          (describedGroup) => ({
            ...describedGroup,
            eventCreators: describedGroup.eventCreators.flatMap((c) =>
              splitEventCreator(c),
            ),
          }),
        ),
      },
    }),
    [originalTask],
  );

  const [statesByStep, commandsByStep, descriptionsByStep, stepIndices] =
    useMemo(() => {
      const initialDoc = docFromAst(
        astFromTypescriptFileContent(
          prettyPrintTsString(task.contentBefore, defaultPrettierOptions),
        ),
      );
      let state = initialDocManagerPublicState;
      const docManager = new DocManager(
        initialDoc,
        (newState) => (state = newState),
        false,
        defaultPrettierOptions,
      );
      docManager.forceUpdate();

      const statesByStep = [state];
      const commandsByStep: (DocManagerCommand | undefined)[] = [undefined];
      const descriptionsByStep: (React.ReactNode | undefined)[] = [undefined];
      const stepIndices: number[][] = [];

      for (const describedGroup of task.example.describedGroups) {
        const stepIndicesThisGroup: number[] = [];
        stepIndices.push(stepIndicesThisGroup);
        for (const eventCreator of describedGroup.eventCreators) {
          const events = eventsFromEventCreator(eventCreator);
          const commands = new Set<DocManagerCommand>();
          for (const eventOrFunction of events) {
            if (typeof eventOrFunction === "function") {
              eventOrFunction(docManager);
            } else {
              const { handler, event } = eventOrFunction;
              const command = docManager[handler](event);
              if (command !== undefined) {
                commands.add(command);
              }
            }
          }

          stepIndicesThisGroup.push(statesByStep.length);
          statesByStep.push(state);
          if (commands.size === 1) {
            const command = commands.values().next().value;
            commandsByStep.push(command);
            descriptionsByStep.push(
              eventCreator.kind === EventCreatorKind.FromKeys
                ? describeCommand(command, eventCreator.keys)
                : undefined,
            );
          } else {
            commandsByStep.push(undefined);
            descriptionsByStep.push(undefined);
          }
        }
      }

      return [statesByStep, commandsByStep, descriptionsByStep, stepIndices];
    }, [task]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(true);
  }, [statesByStep]);
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    if (currentStep + 1 < statesByStep.length) {
      const handle = setInterval(() => {
        setCurrentStep(currentStep + 1);
      }, 500);
      return () => {
        clearInterval(handle);
      };
    } else {
      setIsPlaying(false);
    }
  }, [currentStep, isPlaying, statesByStep]);

  useEffect(() => {
    if (currentStep < statesByStep.length) {
      onStateChange(statesByStep[currentStep]);
    }
  }, [currentStep, statesByStep, onStateChange]);

  const [recentlySwitchedStep, setRecentlySwitchedStep] = useState(false);
  useEffect(() => {
    setRecentlySwitchedStep(true);
    const handle = setTimeout(() => setRecentlySwitchedStep(false), 1000);
    return () => {
      clearTimeout(handle);
    };
  }, [currentStep]);

  const timelineWrapperRef: React.Ref<HTMLDivElement> = useRef(null);
  useEffect(() => {
    if (isPlaying && timelineWrapperRef.current !== null) {
      const target = timelineWrapperRef.current.querySelector(
        `.ExampleStepper-step-${currentStep}`,
      );
      if (target) {
        target.scrollIntoView({ block: "center" });
      }
    }
  }, [isPlaying, currentStep, timelineWrapperRef]);

  const theme = useMantineTheme();

  const timelineActive =
    1 + stepIndices.findIndex((g) => g.includes(currentStep));

  const pointerBullet = (
    <Box style={{ width: "100%", height: "100%", cursor: "pointer" }} />
  );

  return (
    <Stack style={{ height: "100%" }} p="md">
      <Breadcrumbs>
        {task.example.nameParts.map((p, i) => (
          <Text key={i}>{p}</Text>
        ))}
      </Breadcrumbs>
      <Group>
        {isPlaying ? (
          <Button
            leftIcon={<IconPlayerPause />}
            onClick={() => setIsPlaying(false)}
          >
            Pause
          </Button>
        ) : (
          <>
            <Button
              leftIcon={<IconPlayerPlay />}
              onClick={() => {
                setIsPlaying(true);
              }}
              disabled={currentStep + 1 >= statesByStep.length}
            >
              Play
            </Button>
            <Button
              variant="light"
              leftIcon={<IconRefresh />}
              onClick={() => {
                setCurrentStep(0);
                setIsPlaying(true);
              }}
            >
              Replay from start
            </Button>
          </>
        )}
        <ActionIcon
          color="blue"
          size={36}
          variant="light"
          onClick={() => {
            setCurrentStep(Math.max(0, currentStep - 1));
            setIsPlaying(false);
          }}
          disabled={currentStep <= 0}
        >
          <IconPlayerTrackPrev />
        </ActionIcon>
        <ActionIcon
          color="blue"
          size={36}
          variant="light"
          onClick={() => {
            setCurrentStep(Math.min(statesByStep.length - 1, currentStep + 1));
            setIsPlaying(false);
          }}
          disabled={currentStep + 1 >= statesByStep.length}
        >
          <IconPlayerTrackNext />
        </ActionIcon>
      </Group>
      <div
        ref={timelineWrapperRef}
        style={{ flex: "1 1 100px", overflow: "hidden" }}
      >
        <ScrollArea style={{ height: "100%", width: "100%" }}>
          <Timeline active={timelineActive}>
            <Timeline.Item
              bullet={pointerBullet}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(0);
              }}
            >
              Initial state
            </Timeline.Item>
            {task.example.describedGroups.map(
              (describedGroup, iDescribedGroup) => (
                <Timeline.Item
                  bullet={pointerBullet}
                  key={iDescribedGroup}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(
                      stepIndices[iDescribedGroup][
                        stepIndices[iDescribedGroup].length - 1
                      ],
                    );
                  }}
                >
                  <Text style={{ cursor: "pointer" }}>
                    {describedGroup.description}
                  </Text>
                  {describedGroup.bugNote && (
                    <Text>{describedGroup.bugNote}</Text>
                  )}
                  <Group spacing="xs">
                    {describedGroup.eventCreators
                      .map((eventCreator) => (
                        <EventCreatorDisplay eventCreator={eventCreator} />
                      ))
                      .map((element, iEventCreator) => {
                        const step =
                          stepIndices[iDescribedGroup][iEventCreator];
                        const commandLabel = descriptionsByStep[step];
                        return (
                          <Tooltip
                            key={iEventCreator}
                            label={commandLabel}
                            disabled={commandLabel === undefined}
                            position="bottom"
                            opened={
                              ((isPlaying || recentlySwitchedStep) &&
                                commandLabel !== undefined &&
                                step === currentStep) ||
                              undefined
                            }
                          >
                            <Group
                              className={`ExampleStepper-step-${step}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setIsPlaying(false);
                                setCurrentStep(step);
                              }}
                              style={{
                                paddingBottom: "3px",
                                borderBottom: "3px solid",
                                borderBottomColor:
                                  step === currentStep
                                    ? theme.colors.blue[6]
                                    : "transparent",
                                marginBottom: "-3px",
                                cursor: "pointer",
                              }}
                            >
                              {element}
                            </Group>
                          </Tooltip>
                        );
                      })}
                  </Group>
                </Timeline.Item>
              ),
            )}
          </Timeline>
        </ScrollArea>
      </div>
    </Stack>
  );
};
