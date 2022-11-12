import {
  Box,
  FocusTrap,
  Navbar,
  NavLink,
  ScrollArea,
  Title,
} from "@mantine/core";
import { openModal } from "@mantine/modals";
import { IconBrandGithub, IconFileDescription } from "@tabler/icons";
import { sortBy } from "ramda";
import React from "react";
import { ChosenFs } from "../logic/tasks/fs";
import { Task } from "../logic/tasks/interfaces";
import { FileSearch } from "./file-search";
import { RepoSwitcher } from "./repo-switcher";

interface Props {
  openDoc: (doc: { text: string; path?: string }) => void;
  openTask: (taskKey: string) => void;
  fsChoice: ChosenFs;
  tasks: Task[];
  selectedTaskKey?: string;
}

export const Nav = React.memo(
  ({ openDoc, openTask, fsChoice, tasks, selectedTaskKey }: Props) => {
    return (
      <Navbar p="md" width={{ base: 300 }}>
        <Navbar.Section mt="xs">
          <Title order={3}>Forest</Title>
        </Navbar.Section>
        <Navbar.Section grow component={ScrollArea} mx="-xs" px="xs" mt="md">
          <NavLink label="Free editing">
            <NavLink
              label="Blank file"
              onClick={() => {
                openDoc({ text: "" });
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
                              openDoc(docInfo);
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
                    active={selectedTaskKey === t.key}
                    onClick={() => openTask(t.key)}
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
          <NavLink
            component="a"
            icon={<IconFileDescription />}
            label="Preprint"
            href="https://arxiv.org/abs/2210.11124"
            target="_blank"
          />
        </Navbar.Section>
      </Navbar>
    );
  },
);
