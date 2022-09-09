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
    ],
  },
];
