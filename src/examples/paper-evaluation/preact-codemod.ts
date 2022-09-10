import ts from "typescript";
import { DocManager } from "../../logic/doc-manager";
import { ListKind, Node, NodeKind } from "../../logic/interfaces";
import { EventCreatorKind, Example } from "../interfaces";
import { fromKeys, toTypeString } from "../keys";

export const examplesPreactCodemod: Example[] = [
  {
    nameParts: ["paper-evaluation", "preact-codemod", "component-sfc"],
    describedGroups: [
      {
        description: "Search for calls to React.createClass",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for calls to React.createClass",
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
                      isIdentifier(node.content[0], "React") &&
                      isIdentifier(node.content[1], "createClass") &&
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
        description: "Set a mark",
        eventCreators: [fromKeys("m a")],
      },
      {
        description: "Search for return statements containing JSX",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for return statements containing JSX",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isReturnStatement(node.tsNode) &&
                    !!node.tsNode.expression &&
                    ts.isParenthesizedExpression(node.tsNode.expression) &&
                    ts.isJsxElement(node.tsNode.expression.expression),
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Copy containing function",
        eventCreators: [fromKeys("} k c")],
      },
      {
        description:
          'Keep cursors pointing to an object property named "render"',
        eventCreators: [
          fromKeys("k alt-h"),
          {
            kind: EventCreatorKind.Function,
            description:
              'Use structural search UI (not shown) to search for the identifier "render"',
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "render",
                },
                { shallowSearchForRoot: true },
              ),
          },
        ],
      },
      {
        description: "Select the React.createClass call and paste over it",
        eventCreators: [fromKeys("shift-m a p")],
      },
    ],
  },
  {
    nameParts: ["paper-evaluation", "preact-codemod", "props.workaround"],
    describedGroups: [
      {
        description: "Use multi-cursor drop mode",
        eventCreators: [fromKeys("y d")],
      },
      {
        description: "Search for functions",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for functions",
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
        description: "Set a mark",
        eventCreators: [fromKeys("m a")],
      },
      {
        description: 'Search for the identifier "props"',
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              'Use structural search UI (not shown) to search for the identifier "props"',
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "props",
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: 'Keep cursors with "this" to the left of "props"',
        eventCreators: [
          fromKeys("shift-h space"),
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
                { shallowSearchForRoot: true },
              ),
          },
        ],
      },
      {
        description: 'Delete "this"',
        eventCreators: [fromKeys("d")],
      },
      {
        description: "Select arguments of containing function",
        eventCreators: [fromKeys("} k ( )")],
      },
      {
        description: "Keep cursors where argument list is empty",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for empty argument lists",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.kind === NodeKind.List &&
                    node.listKind === ListKind.UnknownTsNodeArray &&
                    node.content.length === 0,
                },
                { shallowSearchForRoot: true },
              ),
          },
        ],
      },
      {
        description: "Add a props argument",
        eventCreators: [
          fromKeys("( i"),
          toTypeString("props"),
          fromKeys("escape"),
        ],
      },
    ],
  },
  {
    nameParts: [
      "paper-evaluation",
      "preact-codemod",
      "removePropTypes.workaround",
    ],
    describedGroups: [
      {
        description: "Search for fake import statements",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for fake import statements",
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
                      isIdentifier(node.content[0], "fakeImport") &&
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
        description: "Search for fake import specifiers named PropTypes",
        eventCreators: [
          fromKeys("["),
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for fake import specifiers named PropTypes",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "PropTypes",
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete selected import specifiers",
        eventCreators: [fromKeys("d")],
      },
      {
        description: "Delete overlapping cursors",
        eventCreators: [fromKeys("shift-s f")],
      },
      {
        description:
          "Keep cursors pointing at an empty list of fake import specifiers",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for an empty list of fake import specifiers",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isArrayLiteralExpression(node.tsNode) &&
                    node.tsNode.elements.length === 0,
                },
                { shallowSearchForRoot: true },
              ),
          },
        ],
      },
      {
        description: "Delete fake import statement",
        eventCreators: [fromKeys(") k d")],
      },
      {
        description: "Select whole document and remove duplicate cursors",
        eventCreators: [fromKeys("k k shift-s f")],
      },
      {
        description: "Search for assignments to PropTypes",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for assignments to PropTypes",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) => {
                    const isPropTypesAccess = (node: Node) =>
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.TightExpression &&
                      node.content.length === 2 &&
                      !!node.content[1].tsNode &&
                      ts.isIdentifier(node.content[1].tsNode) &&
                      node.content[1].tsNode.text === "propTypes";
                    return (
                      node.kind === NodeKind.List &&
                      node.listKind === ListKind.LooseExpression &&
                      node.content.length === 3 &&
                      isPropTypesAccess(node.content[0]) &&
                      node.content[1].tsNode?.kind === ts.SyntaxKind.EqualsToken
                    );
                  },
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: "Delete assignment",
        eventCreators: [fromKeys("d")],
      },
    ],
  },
  {
    nameParts: ["paper-evaluation", "preact-codemod", "state.workaround"],
    describedGroups: [
      {
        description: "Use multi-cursor strict mode",
        eventCreators: [fromKeys("y d")],
      },
      {
        description: "Search for functions",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for functions",
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
        description: "Set a mark",
        eventCreators: [fromKeys("m a")],
      },
      {
        description: 'Search for the identifier "state"',
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              'Use structural search UI (not shown) to search for the identifier "state"',
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    !!node.tsNode &&
                    ts.isIdentifier(node.tsNode) &&
                    node.tsNode.text === "state",
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      {
        description: 'Keep cursors with "this" to the left of "state"',
        eventCreators: [
          fromKeys("shift-h space"),
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
                { shallowSearchForRoot: true },
              ),
          },
        ],
      },
      {
        description: 'Delete "this"',
        eventCreators: [fromKeys("d")],
      },
      {
        description: "Select arguments of containing function",
        eventCreators: [fromKeys("} k ( )")],
      },
      {
        description: "Use multi-cursor strict mode",
        eventCreators: [fromKeys("shift-y i y s")],
      },
      {
        description: "Delete cursors with two arguments",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for argument lists with two arguments",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.kind === NodeKind.List &&
                    node.listKind === ListKind.UnknownTsNodeArray &&
                    node.content.length === 2,
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Add a state argument",
        eventCreators: [
          fromKeys("( i"),
          toTypeString("x,"),
          fromKeys("escape"),
          fromKeys(") ( a"),
          toTypeString(",state"),
          fromKeys("escape"),
          fromKeys(") ( alt-h d"),
        ],
      },
      {
        description: "Delete cursors with two arguments",
        eventCreators: [
          fromKeys(")"),
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for argument lists with two arguments",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.kind === NodeKind.List &&
                    node.listKind === ListKind.UnknownTsNodeArray &&
                    node.content.length === 2,
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y f"),
        ],
      },
      {
        description: "Add a props argument",
        eventCreators: [
          fromKeys("( i"),
          toTypeString("props,"),
          fromKeys("escape"),
        ],
      },
    ],
  },
];
