import ts from "typescript";
import { DocManager } from "../../logic/doc-manager";
import { EventCreatorKind, Example } from "../interfaces";
import { fromKeys, toTypeString } from "../keys";

export const examples5to6Codemod: Example[] = [
  {
    nameParts: ["paper-evaluation", "5to6-codemod", "let"],
    describedGroups: [
      {
        description: "Search for var keyword",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for the var keyword",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.tsNode?.kind === ts.SyntaxKind.VarKeyword,
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete the existing keyword",
        eventCreators: [fromKeys("d")],
      },
      {
        description: "Insert the let keyword",
        eventCreators: [fromKeys("i"), toTypeString("let"), fromKeys("escape")],
      },
    ],
  },
];
