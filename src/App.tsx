import {
  AppShell,
  Box,
  Center,
  FocusTrap,
  Grid,
  Loader,
  Navbar,
  NavLink,
  ScrollArea,
  Stack,
  Title,
} from "@mantine/core";
import { closeAllModals, openModal } from "@mantine/modals";
import { IconBrandGithub, IconFileDescription } from "@tabler/icons";
import { sortBy } from "ramda";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { promisify } from "util";
import {
  CommandHistory,
  CommandHistoryEntry,
} from "./components/command-history";
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
        <Navbar p="md" width={{ base: 300 }}>
          <Navbar.Section mt="xs">
            <Title order={3}>Forest</Title>
          </Navbar.Section>
          <Navbar.Section grow component={ScrollArea} mx="-xs" px="xs" mt="md">
            <NavLink label="Free editing">
              <NavLink
                label="Blank file"
                onClick={() => {
                  setInitialDocInfo({ text: "" });
                  setSelectedTaskKey("");
                }}
              />
              {!fsChoice.probablyEmpty && (
                <NavLink
                  label="Forest source code"
                  onClick={() => {
                    openModal({
                      title: "Select file",
                      children: (
                        <FocusTrap active>
                          <div>
                            <FileSearch
                              fsChoice={fsChoice}
                              onSelect={(docInfo) => {
                                setInitialDocInfo(docInfo);
                                setSelectedTaskKey("");
                                closeAllModals();
                              }}
                            />
                          </div>
                        </FocusTrap>
                      ),
                    });
                  }}
                />
              )}
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
            <Box mt="md">
              <RepoSwitcher fsChoice={fsChoice} />
            </Box>
          </Navbar.Section>
          <Navbar.Section mt="md" my={0}>
            <NavLink
              component="a"
              icon={<IconBrandGithub />}
              label="GitHub repository"
              href="https://github.com/tehwalris/forest"
              target="_blank"
            />
            <NavLink
              component="a"
              icon={<IconFileDescription />}
              label="Published paper"
              href="https://doi.org/10.1145/3563835.3567663"
              target="_blank"
            />
          </Navbar.Section>
        </Navbar>
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
            <CommandHistory
              commandHistory={commandHistory}
              onClear={() => setCommandHistory([])}
            />
          )}
        </Grid.Col>
      </Grid>
    </AppShell>
  );
};
