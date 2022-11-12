import { AppShell, Center, Grid, Loader, Stack, Tabs } from "@mantine/core";
import { closeAllModals } from "@mantine/modals";
import { useCallback, useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import { CommandDocumentation } from "./components/command-documentation";
import {
  CommandHistory,
  CommandHistoryEntry,
} from "./components/command-history";
import { DocUi } from "./components/doc-ui";
import { ExampleStepper } from "./components/example-stepper";
import { LinearEditor } from "./components/linear-editor";
import { Nav } from "./components/nav";
import { eventsFromEventCreator } from "./examples/keys";
import { DocManager, initialDocManagerPublicState } from "./logic/doc-manager";
import { Doc } from "./logic/interfaces";
import { docFromAst } from "./logic/node-from-ts";
import { astFromTypescriptFileContent } from "./logic/parse";
import { defaultPrettierOptions, prettyPrintTsString } from "./logic/print";
import { ChosenFs, configureFs } from "./logic/tasks/fs";
import { Task } from "./logic/tasks/interfaces";
import { loadTasks } from "./logic/tasks/load";
export const App = () => {
  const [fsChoice, setFsChoice] = useState<ChosenFs>();
  useEffect(() => {
    (async () => {
      const _fs = await configureFs(
        true,
        "/demo.zip",
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
  }>({ text: "" });
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
    }
  }, [selectedTask]);
  const [stepperDocManagerState, setStepperDocManagerState] = useState(
    initialDocManagerPublicState,
  );
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>(
    [],
  );
  useEffect(() => {
    setCommandHistory([]);
  }, [selectedTask, initialDoc]);
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "l" && ev.ctrlKey) {
        ev.preventDefault();
        ev.stopPropagation();
        setCommandHistory([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);
  const openDoc = useCallback((doc: { text: string; path?: string }) => {
    setInitialDocInfo(doc);
    setSelectedTaskKey("");
    closeAllModals();
  }, []);
  const openTask = useCallback((taskKey: string) => {
    setInitialDocInfo({ text: "" });
    setSelectedTaskKey(taskKey);
    closeAllModals();
  }, []);
  if (!fsChoice) {
    return (
      <Center sx={{ height: "100vh" }}>
        <Stack align="center">
          <Loader />
          Loading examples...
        </Stack>
      </Center>
    );
  }
  return (
    <AppShell
      padding={0}
      navbar={
        <Nav
          openDoc={openDoc}
          openTask={openTask}
          fsChoice={fsChoice}
          tasks={tasks}
          selectedTaskKey={selectedTask?.key}
        />
      }
    >
      <Grid style={{ height: "100vh", overflow: "hidden", margin: 0 }}>
        <Grid.Col
          span={6}
          p={0}
          sx={(theme) => ({
            borderRight: `1px solid ${theme.colors.gray[2]}`,
            background: theme.colors.gray[0],
            height: "100%",
          })}
        >
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
              onCommand={(event, command) =>
                setCommandHistory((h) => [...h, { event, command }])
              }
            />
          )}
        </Grid.Col>
        <Grid.Col span={6} p={0} style={{ height: "100%" }}>
          {selectedTask ? (
            <ExampleStepper
              task={selectedTask}
              onStateChange={setStepperDocManagerState}
            />
          ) : (
            <Tabs
              defaultValue="CommandDocumentation"
              keepMounted={false}
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Tabs.List>
                <Tabs.Tab value="CommandDocumentation">
                  Command reference
                </Tabs.Tab>
                <Tabs.Tab value="CommandHistory">Command history</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel
                value="CommandDocumentation"
                style={{ flexGrow: 1, overflow: "hidden" }}
              >
                <CommandDocumentation />
              </Tabs.Panel>
              <Tabs.Panel
                value="CommandHistory"
                style={{ flexGrow: 1, overflow: "hidden" }}
              >
                <CommandHistory
                  commandHistory={commandHistory}
                  onClear={() => setCommandHistory([])}
                />
              </Tabs.Panel>
            </Tabs>
          )}
        </Grid.Col>
      </Grid>
    </AppShell>
  );
};
