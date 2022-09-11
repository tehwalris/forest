import {
  ActionIcon,
  Breadcrumbs,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import {
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlayerStop,
  IconRefresh,
} from "@tabler/icons";
import { useEffect, useMemo, useState } from "react";
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

  const timelineActive =
    1 + stepIndices.findIndex((g) => g.includes(currentStep));

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
      <ScrollArea style={{ flex: "1 1 100px" }}>
        <Timeline active={timelineActive}>
          <Timeline.Item
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
                <Text>{describedGroup.description}</Text>
                {describedGroup.bugNote && (
                  <Text>{describedGroup.bugNote}</Text>
                )}
                {JSON.stringify(describedGroup.eventCreators)}
              </Timeline.Item>
            ),
          )}
        </Timeline>
      </ScrollArea>
    </Stack>
  );
};
