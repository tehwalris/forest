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
              "Use structural search UI (not shown) to search for jest.disableAutomock() or jest.autoMockOff() used as a whole statement",
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
              "Use structural search UI (not shown) to search for disableAutomock",
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
  {
    nameParts: ["paper-evaluation", "js-codemod", "rm-merge"],
    describedGroups: [
      {
        description: "Search for calls to merge",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for calls to merge",
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
                      node.content.length === 2 &&
                      isIdentifier(node.content[0], "merge") &&
                      isCall(node.content[1])
                    );
                  },
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Create an empty parenthesized object literal",
        eventCreators: [
          fromKeys("( i"),
          toTypeString("({}),"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Select the original arguments of merge",
        eventCreators: [fromKeys(") ( ctrl-shift-l")],
      },
      {
        description: "Split cursor and copy",
        eventCreators: [fromKeys("s c")],
      },
      {
        description: "Insert SpreadAssignments for each cursor",
        eventCreators: [
          fromKeys("k alt-h { i"),
          toTypeString("...x,"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Paste the copied expression",
        eventCreators: [fromKeys("alt-l p")],
      },
      {
        description: "Keep cursors which point at object literals",
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
        ],
      },
      {
        description:
          "Replace the spread by the properties of the object literal",
        eventCreators: [fromKeys("{ c } k p")],
      },
      {
        description: "Reduce to first cursor and select whole file",
        eventCreators: [fromKeys("shift-s h shift-s h ) ) k k")],
      },
      {
        description: "Search for calls to merge",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for calls to merge",
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
                      node.content.length === 2 &&
                      isIdentifier(node.content[0], "merge") &&
                      isCall(node.content[1])
                    );
                  },
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Replace the call by the newly created first argument",
        eventCreators: [fromKeys("( alt-h c ) k p")],
      },
      {
        description: "Reduce to first cursor",
        eventCreators: [fromKeys("shift-s l")],
        bugNote:
          "Reduce to first cursor gives the wrong cursor. Using reduce to last cursor to work around that.",
      },
      {
        description: "Remove parentheses",
        eventCreators: [fromKeys("( c ) p")],
      },
      {
        description: "Select whole file",
        eventCreators: [fromKeys("k k k")],
      },
      {
        description: 'Search for require("merge")',
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              'Use structural search UI (not shown) to search for require("merge")',
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => {
                    const isIdentifier = (node: Node, text: string) =>
                      !!node.tsNode &&
                      ts.isIdentifier(node.tsNode) &&
                      node.tsNode.text === text;
                    const isCallWithString = (node: Node, text: string) =>
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.CallArguments &&
                      node.content.length === 1 &&
                      !!node.content[0].tsNode &&
                      ts.isStringLiteral(node.content[0].tsNode) &&
                      node.content[0].tsNode.text === text;
                    return (
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.TightExpression &&
                      node.content.length === 2 &&
                      isIdentifier(node.content[0], "require") &&
                      isCallWithString(node.content[1], "merge")
                    );
                  },
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete whole statement",
        eventCreators: [fromKeys("k k d")],
      },
    ],
  },
  {
    nameParts: ["paper-evaluation", "js-codemod", "unchain-variables"],
    describedGroups: [
      {
        description: "Deselect for loop. Split cursor (one per statement).",
        eventCreators: [fromKeys("ctrl-shift-h s")],
      },
      {
        description:
          "Deselect keyword. Split cursor (one per declaration). Mark and copy declaration.",
        eventCreators: [fromKeys("ctrl-shift-l s m a c")],
      },
      {
        description: "Move up to statement (cursors overlap)",
        label: "statement-overlap",
        eventCreators: [fromKeys("k")],
      },
      {
        description:
          "Insert new statements (multiple copies inserted due to overlapping cursors)",
        label: "insert",
        eventCreators: [
          fromKeys("i"),
          toTypeString("var x;"),
          fromKeys("escape"),
        ],
      },
      {
        description:
          "Paste declaration into new statement and mark the paste location",
        eventCreators: [fromKeys("alt-l p m b")],
      },
      {
        description: "Go to old keyword, copy it, and jump back, and paste it.",
        label: "keyword-overlap",
        eventCreators: [fromKeys("shift-m a k alt-h c shift-m b h p")],
      },
      {
        description:
          "Delete all cursors except the first (per old statement). Delete the old statement.",
        eventCreators: [fromKeys("shift-s h shift-m a k d")],
      },
    ],
  },
];
