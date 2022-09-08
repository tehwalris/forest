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
  {
    nameParts: ["paper-evaluation", "5to6-codemod", "no-strict"],
    describedGroups: [
      {
        description: 'Search for "use strict"',
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for ExpressionStatement with string literal",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isExpressionStatement(node.tsNode) &&
                    ts.isStringLiteral(node.tsNode.expression) &&
                    node.tsNode.expression.text === "use strict",
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete the statement",
        eventCreators: [fromKeys("d")],
      },
    ],
  },
  {
    nameParts: ["paper-evaluation", "5to6-codemod", "simple-arrow"],
    describedGroups: [
      {
        description: "Search for functions with only return in body",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for functions with only return in body",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isFunctionExpression(node.tsNode) &&
                    ts.isBlock(node.tsNode.body) &&
                    node.tsNode.body.statements.length === 1 &&
                    ts.isReturnStatement(node.tsNode.body.statements[0]),
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Set a mark on the original function",
        eventCreators: [fromKeys("m a")],
      },
      {
        description: "Insert an arrow function and set a mark",
        eventCreators: [
          fromKeys("{ i"),
          toTypeString("()=>x;"),
          fromKeys("escape m b"),
        ],
      },
      {
        description: "Copy the expression from the returned statement",
        eventCreators: [fromKeys("shift-l space alt-l c")],
      },
      {
        description: "Paste the expression into the arrow function",
        eventCreators: [fromKeys("shift-m b alt-l p")],
      },
      {
        description: "Copy the arguments from the original function",
        eventCreators: [fromKeys("shift-m a ( c")],
      },
      {
        description: "Paste the arguments into the arrow function",
        eventCreators: [fromKeys("shift-m b ( p")],
      },
      {
        description: "Replace the function with the arrow function",
        eventCreators: [fromKeys("k k c } k p")],
      },
    ],
  },
];
