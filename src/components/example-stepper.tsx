import {
  ActionIcon,
  Box,
  Breadcrumbs,
  Button,
  Code,
  Group,
  Kbd,
  ScrollArea,
  Stack,
  Text,
  Timeline,
  useMantineTheme,
} from "@mantine/core";
import {
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlayerStop,
  IconRefresh,
} from "@tabler/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { EventCreatorKind } from "../examples/interfaces";
import { eventsFromEventCreator, splitEventCreator } from "../examples/keys";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
} from "../logic/doc-manager";
import { docFromAst } from "../logic/node-from-ts";
import { astFromTypescriptFileContent } from "../logic/parse";
import { defaultPrettierOptions, prettyPrintTsString } from "../logic/print";
import { Task } from "../logic/tasks/interfaces";
import { unreachable } from "../logic/util";

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

  const [statesByStep, stepIndices] = useMemo(() => {
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

    const stepIndices: number[][] = [];
    const statesByStep = [state];

    for (const describedGroup of task.example.describedGroups) {
      const stepIndicesThisGroup: number[] = [];
      stepIndices.push(stepIndicesThisGroup);
      for (const eventCreator of describedGroup.eventCreators) {
        const events = eventsFromEventCreator(eventCreator);
        for (const eventOrFunction of events) {
          if (typeof eventOrFunction === "function") {
            eventOrFunction(docManager);
          } else {
            const { handler, event } = eventOrFunction;
            docManager[handler](event);
          }
        }

        stepIndicesThisGroup.push(statesByStep.length);
        statesByStep.push(state);
      }
    }

    return [statesByStep, stepIndices];
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
    <Stack style={{ height: "100%" }}>
      <Breadcrumbs>
        {task.example.nameParts.map((p, i) => (
          <Text key={i}>{p}</Text>
        ))}
      </Breadcrumbs>
      <Group>
        {isPlaying ? (
          <Button
            leftIcon={<IconPlayerStop />}
            onClick={() => setIsPlaying(false)}
          >
            Stop replay
          </Button>
        ) : (
          <Button
            leftIcon={<IconRefresh />}
            onClick={() => {
              setCurrentStep(0);
              setIsPlaying(true);
            }}
          >
            Replay edit
          </Button>
        )}
        <ActionIcon
          onClick={() => {
            setCurrentStep(Math.max(0, currentStep - 1));
            setIsPlaying(false);
          }}
        >
          <IconPlayerSkipBack />
        </ActionIcon>
        <ActionIcon
          onClick={() => {
            setCurrentStep(Math.min(statesByStep.length - 1, currentStep + 1));
            setIsPlaying(false);
          }}
        >
          <IconPlayerSkipForward />
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
                      .map((eventCreator) => {
                        switch (eventCreator.kind) {
                          case EventCreatorKind.FromKeys:
                            return (
                              <Kbd style={{ padding: "1px 5px 0 5px" }}>
                                {eventCreator.keys
                                  .split("-")
                                  .map((s) => {
                                    // HACK This is not always correct with cords, but doesn't matter in any of the examples that we actually have.
                                    const lookup: {
                                      [key: string]: string | undefined;
                                    } = { k: "↑", l: "→", j: "↓", h: "←" };
                                    return lookup[s] || s;
                                  })
                                  .map((s) => s[0].toUpperCase() + s.slice(1))
                                  .join(" + ")}
                              </Kbd>
                            );
                          case EventCreatorKind.ToTypeString:
                            return (
                              <Group spacing={5} align="flex-end">
                                <Text italic>Type</Text>{" "}
                                <Code>{eventCreator.string}</Code>
                              </Group>
                            );
                          case EventCreatorKind.Function:
                            return (
                              <Text italic>{eventCreator.description}</Text>
                            );
                          default:
                            return unreachable(eventCreator);
                        }
                      })
                      .map((element, iEventCreator) => {
                        const step =
                          stepIndices[iDescribedGroup][iEventCreator];
                        return (
                          <Group
                            key={iEventCreator}
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
