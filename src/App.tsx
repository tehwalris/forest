import {
  AppShell,
  Grid,
  Navbar,
  NavLink,
  ScrollArea,
  Title,
} from "@mantine/core";
import { sortBy } from "ramda";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import { DocUi } from "./components/doc-ui";
import { ExampleStepper } from "./components/example-stepper";
import { FileSearch } from "./components/file-search";
import { LinearEditor } from "./components/linear-editor";
import { RepoSwitcher } from "./components/repo-switcher";
import { eventsFromEventCreator } from "./examples/keys";
import { DocManager, initialDocManagerPublicState } from "./logic/doc-manager";
import { Doc } from "./logic/interfaces";
import { docFromAst } from "./logic/node-from-ts";
import { astFromTypescriptFileContent } from "./logic/parse";
import { defaultPrettierOptions, prettyPrintTsString } from "./logic/print";
import { ChosenFs, configureFs } from "./logic/tasks/fs";
import { Task } from "./logic/tasks/interfaces";
import { loadTasks } from "./logic/tasks/load";
const exampleFileText = `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else if (walrus) {
          console.log("even better");
        }
`;
export const App = () => {
  const [fsChoice, setFsChoice] = useState<ChosenFs>();
  useEffect(() => {
    (async () => {
      const _fs = await configureFs(
        false,
        undefined,
        window.location.hash === "#demo",
      );
      setFsChoice(_fs);
    })().catch((err) => console.error("failed to configure remote fs", err));
  }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!fsChoice) {
      return;
    }
    (async () => {
      setTasks(await loadTasks(fsChoice));
    })().catch((err) => console.error("failed to load tasks", err));
  }, [fsChoice]);
  const [initialDocInfo, setInitialDocInfo] = useState<{
    path?: string;
    text: string;
    initDocManager?: (docManager: DocManager) => void;
  }>({ text: exampleFileText });
  const initialDoc = useMemo(
    () =>
      docFromAst(
        astFromTypescriptFileContent(
          prettyPrintTsString(initialDocInfo.text, defaultPrettierOptions),
        ),
      ),
    [initialDocInfo],
  );
  const [_selectedTaskKey, setSelectedTaskKey] = useState("");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.key === _selectedTaskKey),
    [tasks, _selectedTaskKey],
  );
  useEffect(() => {
    if (selectedTask) {
      setInitialDocInfo({
        text: selectedTask.contentBefore,
        initDocManager:
          selectedTask.example &&
          ((docManager) => {
            const events = selectedTask
              .example!.describedGroups.flatMap((g) => g.eventCreators)
              .flatMap((c) => eventsFromEventCreator(c));

            try {
              docManager.forceUpdate();
              for (const eventOrFunction of events) {
                if (typeof eventOrFunction === "function") {
                  eventOrFunction(docManager);
                } else {
                  const { handler, event } = eventOrFunction;
                  docManager[handler](event);
                }
              }
            } catch (err) {
              console.warn("failed to run example", err);
            }
          }),
      });
    } else {
      setInitialDocInfo({ text: exampleFileText });
    }
  }, [selectedTask]);
  const [stepperDocManagerState, setStepperDocManagerState] = useState(
    initialDocManagerPublicState,
  );
  if (!fsChoice) {
    return <div>Connecting to remote filesystem...</div>;
  }
  return (
    <AppShell
      padding="md"
      navbar={
        <Navbar p="xs" width={{ base: 300 }}>
          <Navbar.Section mt="xs">
            <Title order={3}>Forest</Title>
          </Navbar.Section>
          <Navbar.Section mt="xs">
            <div>
              <RepoSwitcher fsChoice={fsChoice} />
            </div>
            {!fsChoice.probablyEmpty && (
              <div>
                Real files:{" "}
                <FileSearch fsChoice={fsChoice} onSelect={setInitialDocInfo} />
              </div>
            )}
          </Navbar.Section>
          <Navbar.Section grow component={ScrollArea} mx="-xs" px="xs">
            <NavLink label="Free editing">
              <NavLink label="Blank file" />
              <NavLink label="Forest source code" />
            </NavLink>
            {!fsChoice.probablyEmpty &&
              [
                ["paper-evaluation", "Paper evaluation"],
                ["paper-examples", "Paper examples"],
              ].map(([sectionKey, sectionLabel]) => (
                <NavLink key={sectionKey} label={sectionLabel}>
                  {sortBy(
                    (t) => t.key,
                    tasks.filter((t) => t.example.nameParts[0] === sectionKey),
                  ).map((t) => (
                    <NavLink
                      label={t.example.nameParts.slice(1).join("/")}
                      key={t.key}
                      active={selectedTask?.key === t.key}
                      onClick={() => setSelectedTaskKey(t.key)}
                    />
                  ))}
                </NavLink>
              ))}
          </Navbar.Section>
        </Navbar>
      }
    >
      <Grid style={{ height: "100%", overflow: "hidden" }}>
        <Grid.Col span={6}>
          {selectedTask ? (
            <DocUi state={stepperDocManagerState} alwaysStyleLikeFocused />
          ) : (
            <LinearEditor
              initialDoc={initialDoc}
              initDocManager={initialDocInfo.initDocManager}
              onSave={(doc: Doc) =>
                (async () => {
                  if (!initialDocInfo.path) {
                    console.warn("open file has no save path");
                    return;
                  }
                  await promisify(fsChoice.fs.writeFile)(
                    initialDocInfo.path,
                    doc.text,
                    {
                      encoding: "utf8",
                    },
                  );
                })().catch((err) => console.warn("failed to save file", err))
              }
            />
          )}
        </Grid.Col>
        <Grid.Col span={6}>
          {selectedTask ? (
            <ExampleStepper
              task={selectedTask}
              onStateChange={setStepperDocManagerState}
            />
          ) : (
            "No example selected"
          )}
        </Grid.Col>
      </Grid>
    </AppShell>
  );
};
