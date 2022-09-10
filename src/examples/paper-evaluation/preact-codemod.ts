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
];
