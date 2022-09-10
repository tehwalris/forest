import ts from "typescript";
import { DocManager } from "../../logic/doc-manager";
import { ListKind, Node, NodeKind } from "../../logic/interfaces";
import { isToken } from "../../logic/ts-type-predicates";
import { EventCreatorKind, Example } from "../interfaces";
import { fromKeys, toTypeString } from "../keys";

export const examplesJsCodemod: Example[] = [
  {
    nameParts: ["paper-evaluation", "js-codemod", "arrow-function"],
    describedGroups: [
      {
        description: "Search for function expressions used with bind(this)",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for function expressions used with bind(this)",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => {
                    const isFunctionExpression = (node: Node) =>
                      !!node.tsNode && ts.isFunctionExpression(node.tsNode);
                    const isIdentifier = (node: Node, text: string) =>
                      !!node.tsNode &&
                      ts.isIdentifier(node.tsNode) &&
                      node.tsNode.text === text;
                    const isCallWithThis = (node: Node) =>
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.CallArguments &&
                      node.content.length === 1 &&
                      node.content[0].tsNode?.kind ===
                        ts.SyntaxKind.ThisKeyword;
                    return (
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.TightExpression &&
                      node.content.length === 3 &&
                      !!node.content[0].tsNode &&
                      isFunctionExpression(node.content[0]) &&
                      isIdentifier(node.content[1], "bind") &&
                      isCallWithThis(node.content[2])
                    );
                  },
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
        description: "Copy the body of the original function",
        eventCreators: [fromKeys("{ } c k")],
      },
      {
        description:
          "Select place where generator functions have their asterisk",
        eventCreators: [fromKeys("alt-h alt-h shift-l space")],
      },
      {
        description: "Delete cursors which have an asterisk selected",
        eventCreators: [
          fromKeys("y s"),
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for asterisk tokens",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => isToken(node, ts.isAsteriskToken),
                },
                { shallowSearchForRoot: false },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Delete cursors on functions which have a name",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for identifiers",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode && ts.isIdentifier(node.tsNode),
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Insert an arrow function and set a mark",
        eventCreators: [
          fromKeys("k { i"),
          toTypeString("()=>x;"),
          fromKeys("escape m b"),
        ],
      },
      {
        description: "Paste the body into the arrow function",
        eventCreators: [fromKeys("alt-l p")],
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
        eventCreators: [fromKeys("k k c } k k p")],
      },
      {
        description: "Reduce to first cursor and select whole file",
        eventCreators: [fromKeys("shift-s h k k k")],
      },
      {
        description: "Search for function expressions",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for function expressions",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode && ts.isFunctionExpression(node.tsNode),
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete cursors which contain this",
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
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Set a mark on the original function",
        eventCreators: [fromKeys("m a")],
      },
      {
        description: "Copy the body of the original function",
        eventCreators: [fromKeys("{ } c k")],
      },
      {
        description:
          "Select place where generator functions have their asterisk",
        eventCreators: [fromKeys("alt-h shift-l space")],
      },
      {
        description: "Delete cursors which have an asterisk selected",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for asterisk tokens",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => isToken(node, ts.isAsteriskToken),
                },
                { shallowSearchForRoot: false },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Delete cursors on functions which have a name",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for identifiers",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode && ts.isIdentifier(node.tsNode),
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Delete cursors where function is used with bind",
        eventCreators: [
          fromKeys("k shift-l space"),
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for the identifier bind",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "bind",
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Insert an arrow function and set a mark",
        eventCreators: [
          fromKeys("shift-m a { i"),
          toTypeString("()=>x;"),
          fromKeys("escape m b"),
        ],
      },
      {
        description: "Paste the body into the arrow function",
        eventCreators: [fromKeys("alt-l p")],
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
      {
        description: "Reduce to first cursor and select whole file",
        eventCreators: [fromKeys("shift-s h k k k")],
      },
      {
        description:
          "Search for arrow functions containing only a return statement",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for arrow functions containing only a return statement",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isArrowFunction(node.tsNode) &&
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
        description: "Replace block by parenthesized return value",
        eventCreators: [
          fromKeys("{ alt-l c } d a"),
          toTypeString("(x)"),
          fromKeys("escape ( p"),
        ],
      },
      {
        description: "Delete cursors which are object literals",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for object literals",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode && ts.isObjectLiteralExpression(node.tsNode),
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Remove parentheses",
        eventCreators: [fromKeys("c ) p")],
      },
      {
        description: "Reduce to first cursor and select whole file",
        eventCreators: [fromKeys("shift-s h k k k k")],
      },
      {
        description:
          "Search for arrow functions containing only one ExpressionStatement",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for arrow functions containing only one ExpressionStatement",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isArrowFunction(node.tsNode) &&
                    ts.isBlock(node.tsNode.body) &&
                    node.tsNode.body.statements.length === 1 &&
                    ts.isExpressionStatement(node.tsNode.body.statements[0]),
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Replace arrow function body by expression",
        eventCreators: [fromKeys("{ c } p")],
      },
    ],
  },
  {
    nameParts: [
      "paper-evaluation",
      "js-codemod",
      "jest-remove-disable-automock",
    ],
    describedGroups: [
      {
        description:
          "Search for jest.disableAutomock() or jest.autoMockOff() used as a whole statement",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for for jest.disableAutomock() or jest.autoMockOff() used as a whole statement",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => {
                    const isIdentifier = (node: Node, text: string) =>
                      !!node.tsNode &&
                      ts.isIdentifier(node.tsNode) &&
                      node.tsNode.text === text;
                    const isCall = (node: Node) =>
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.CallArguments;
                    return (
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.TightExpression &&
                      node.content.length === 3 &&
                      isIdentifier(node.content[0], "jest") &&
                      (isIdentifier(node.content[1], "disableAutomock") ||
                        isIdentifier(node.content[1], "autoMockOff")) &&
                      isCall(node.content[2])
                    );
                  },
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete statement",
        eventCreators: [fromKeys("d")],
      },
      {
        description: "Reduce to first cursor and select whole file",
        eventCreators: [fromKeys("shift-s h k")],
      },
      {
        description: "Search for other uses of disableAutomock",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for for disableAutomock",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "disableAutomock",
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete the call while keeping chained calls",
        eventCreators: [fromKeys("shift-l d")],
      },
    ],
  },
];
