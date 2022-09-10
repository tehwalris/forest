import ts from "typescript";
import { DocManager } from "../../logic/doc-manager";
import { EventCreatorKind, Example } from "../interfaces";
import { fromKeys, toTypeString } from "../keys";

export const examplesMocha2AvaCodemod: Example[] = [
  {
    nameParts: ["paper-evaluation", "mocha2ava-codemod", "this2context"],
    describedGroups: [
      {
        description: "Search for this",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for ThisExpression",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.tsNode?.kind === ts.SyntaxKind.ThisKeyword,
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Append t.context",
        eventCreators: [
          fromKeys("a"),
          toTypeString(".t.context"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Delete this",
        eventCreators: [fromKeys("h d")],
      },
    ],
  },
];
