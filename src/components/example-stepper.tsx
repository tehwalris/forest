import { Breadcrumbs, ScrollArea, Stack, Text, Timeline } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { eventsFromEventCreator } from "../examples/keys";
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

export const ExampleStepper = ({ task, onStateChange }: Props) => {
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
  useEffect(() => {
    setCurrentStep(0);
  }, [statesByStep]);

  useEffect(() => {
    onStateChange(statesByStep[currentStep]);
  }, [currentStep, statesByStep, onStateChange]);

  const timelineActive =
    1 + stepIndices.findIndex((g) => g.includes(currentStep));

  return (
    <Stack style={{ height: "100%" }}>
      <Breadcrumbs>
        {task.example.nameParts.map((p) => (
          <Text>{p}</Text>
        ))}
      </Breadcrumbs>
      <ScrollArea style={{ flex: "1 1 100px" }}>
        <Timeline active={timelineActive}>
          <Timeline.Item onClick={() => setCurrentStep(0)}>
            Initial state
          </Timeline.Item>
          {task.example.describedGroups.map(
            (describedGroup, iDescribedGroup) => (
              <Timeline.Item
                key={iDescribedGroup}
                onClick={() =>
                  setCurrentStep(
                    stepIndices[iDescribedGroup][
                      stepIndices[iDescribedGroup].length - 1
                    ],
                  )
                }
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
