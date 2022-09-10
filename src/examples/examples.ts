import ts from "typescript";
import { DocManager } from "../logic/doc-manager";
import { ListKind, NodeKind } from "../logic/interfaces";
import {
  DescribedGroup,
  EventCreator,
  EventCreatorKind,
  Example,
} from "./interfaces";
import { fromKeys, toTypeString } from "./keys";
import { examples5to6Codemod } from "./paper-evaluation/5to6-codemod";
import { examplesJsCodemod } from "./paper-evaluation/js-codemod";
import { examplesMocha2AvaCodemod } from "./paper-evaluation/mocha2ava-codemod";
import { examplesPreactCodemod } from "./paper-evaluation/preact-codemod";
const eventCreatorSearchForJestCalls: EventCreator = {
  kind: EventCreatorKind.Function,
  description:
    "Use structural search UI (not shown) to find calls with callee names matching a regular expression and having a function expression as the second argument",
  function: (docManager: DocManager) =>
    docManager.search(
      {
        match: (node) => {
          function tsNodeIsItDescribe(node: ts.Node | undefined): boolean {
            return (
              !!node &&
              ts.isIdentifier(node) &&
              !!node.text.match(/^x?(?:it|describe)$/)
            );
          }
          function tsNodeIsString(node: ts.Node | undefined): boolean {
            return !!node && ts.isStringLiteral(node);
          }
          function tsNodeIsFunction(node: ts.Node | undefined): boolean {
            return !!node && ts.isFunctionExpression(node);
          }
          return (
            node.kind === NodeKind.List &&
            node.listKind === ListKind.TightExpression &&
            node.content.length === 2 &&
            tsNodeIsItDescribe(node.content[0].tsNode) &&
            node.content[1].kind === NodeKind.List &&
            node.content[1].listKind === ListKind.CallArguments &&
            node.content[1].content.length === 2 &&
            tsNodeIsString(node.content[1].content[0].tsNode) &&
            tsNodeIsFunction(node.content[1].content[1].tsNode)
          );
        },
      },
      { shallowSearchForRoot: false },
    ),
};
export const examples: Example[] = [
  ...examples5to6Codemod,
  ...examplesJsCodemod,
  ...examplesMocha2AvaCodemod,
  ...examplesPreactCodemod,
  {
    nameParts: ["multi-cursor-reduce-across"],
    describedGroups: [
      {
        description: "Split cursor (one per function)",
        eventCreators: [fromKeys("s")],
      },
      {
        description: "Go to parameters and split cursor (one per parameter)",
        eventCreators: [fromKeys("( s")],
      },
      {
        description: "Add type annotation to parameter",
        eventCreators: [
          fromKeys("a"),
          toTypeString(":number"),
          fromKeys("escape"),
        ],
      },
      {
        label: "reduce",
        description: "Remove all cursors except the first (per function)",
        eventCreators: [fromKeys("shift-s h")],
      },
      {
        description: "Add return type annotation",
        eventCreators: [
          fromKeys(") a"),
          toTypeString(":number"),
          fromKeys("escape"),
        ],
      },
    ],
  },
  {
    nameParts: ["multi-cursor-marks"],
    describedGroups: [
      {
        description: "Insert at start of function body",
        eventCreators: [
          fromKeys("{ i"),
          toTypeString("if(debug){console.log({})}"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Select and mark empty object literal",
        eventCreators: [fromKeys("{ { } m a")],
      },
      {
        description: "Append function parameter",
        eventCreators: [
          fromKeys("} } shift-h space j a"),
          toTypeString(",debug:boolean=false"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Select parameters except debug and split cursor",
        eventCreators: [fromKeys("k ctrl-shift-h s")],
      },
      {
        description: "Mark parameter and copy parameter name",
        eventCreators: [fromKeys("m b alt-h c")],
      },
      {
        description: "Insert inside marked empty object literal",
        eventCreators: [
          fromKeys("shift-m a j a"),
          toTypeString("x: {current: x, default: x},"),
          fromKeys("escape"),
        ],
      },
      {
        description: 'Paste name over first two "x"s',
        eventCreators: [fromKeys("alt-h p l l p")],
      },
      {
        description: 'Move to last "x" and mark it',
        eventCreators: [fromKeys("l l m c")],
      },
      {
        description:
          "Jump to marked parameter declaration and copy initializer",
        eventCreators: [fromKeys("shift-m b alt-l c")],
      },
      {
        description: 'Jump to last "x" and paste initializer',
        eventCreators: [fromKeys("shift-m c p")],
      },
    ],
  },
  {
    nameParts: ["cpojer-js-codemod-jest-arrow-flat"],
    describedGroups: [
      {
        description: "Search for function expressions",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for function expressions (with any content)",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.tsNode?.kind === ts.SyntaxKind.FunctionExpression,
                },
                { shallowSearchForRoot: false },
              ),
          },
        ],
      },
      { description: "Copy function body", eventCreators: [fromKeys("{ } c")] },
      {
        description: "Create arrow function and paste body",
        eventCreators: [
          fromKeys("k i"),
          toTypeString("()=>{},"),
          fromKeys("escape { } p"),
        ],
      },
      {
        description: "Delete function expression",
        eventCreators: [fromKeys("shift-l space d")],
      },
    ],
  },
  {
    nameParts: ["cpojer-js-codemod-jest-arrow-fail"],
    describedGroups: [
      {
        description: "Search for ``it'' and ``describe'' calls",
        eventCreators: [eventCreatorSearchForJestCalls],
      },
      { description: "Copy function body", eventCreators: [fromKeys("{ } c")] },
      {
        description:
          "Create arrow function and paste body. This is the problematic step. Changes from inner cursors are lost, because they were made after the function body was copied.",
        eventCreators: [
          fromKeys("k i"),
          toTypeString("()=>{},"),
          fromKeys("escape { } p"),
        ],
      },
      {
        description: "Delete function expression",
        eventCreators: [fromKeys("shift-l space d")],
      },
    ],
  },
  {
    nameParts: ["cpojer-js-codemod-jest-arrow"],
    describedGroups: [
      ...[1, 2, 3].flatMap((i): DescribedGroup[] => [
        {
          description: `Pass ${i}: Search for ${"``it`` and ``describe''"} calls. Delete all cursors except innermost.`,
          eventCreators: [
            eventCreatorSearchForJestCalls,
            fromKeys("shift-s j"),
          ],
        },
        {
          description: `Pass ${i}: Copy function body. Create arrow function. Paste body. Delete function expression.`,
          eventCreators: [
            fromKeys("{ } c k i"),
            toTypeString("()=>{},"),
            fromKeys("escape { } p shift-l space d"),
          ],
        },
        ...(i === 3
          ? []
          : [
              {
                description:
                  "Select whole document and remove duplicate cursors.",
                eventCreators: [fromKeys(") ) ) k k shift-s f")],
              },
            ]),
      ]),
    ],
  },
  {
    nameParts: ["cpojer-js-codemod-rm-object-assign-basic"],
    describedGroups: [
      {
        description:
          "Split cursors (one per call) and select its arguments. Switch to multi-cursor strict mode.",
        label: "get-object-assign",
        eventCreators: [fromKeys("s ( y s")],
      },
      {
        description:
          "Check whether first argument is an object and show successful/failed cursors",
        label: "check-object-literal",
        eventCreators: [
          fromKeys("alt-h"),
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to check whether the selected node is an object literal",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.tsNode?.kind === ts.SyntaxKind.ObjectLiteralExpression,
                },
                { shallowSearchForRoot: true },
              ),
          },
          fromKeys("shift-y"),
        ],
      },
      {
        description:
          "Keep successful cursors. Select all arguments except first.",
        label: "keep-object-literal",
        eventCreators: [fromKeys("s k ctrl-shift-l")],
      },
      {
        description:
          "Search for spread elements and show successful/failed cursors",
        label: "check-spread",
        eventCreators: [
          {
            kind: EventCreatorKind.Function,
            description:
              "Use structural search UI (not shown) to search for spread elements",
            function: (docManager: DocManager) =>
              docManager.search(
                {
                  match: (node) =>
                    node.tsNode?.kind === ts.SyntaxKind.SpreadElement,
                },
                { shallowSearchForRoot: false },
              ),
          },
          fromKeys("shift-y"),
        ],
      },
      {
        description:
          "Keep failed cursors. Append object literal to argument list. Select other arguments and split cursor (one for each old argument).",
        label: "keep-no-spread",
        eventCreators: [
          fromKeys("f k a"),
          toTypeString(",{}"),
          fromKeys("escape k ctrl-shift-h s"),
        ],
      },
      {
        description:
          "Copy argument. Insert placeholder spread element into object. Paste argument.",
        eventCreators: [
          fromKeys("c ) alt-l { a"),
          toTypeString("...(x),"),
          fromKeys("escape ( p"),
        ],
      },
      {
        description:
          "Remove all cursors except first. Copy new object literal. Insert placeholder where it will later be pasted.",
        eventCreators: [
          fromKeys("shift-s h } c ) k i"),
          toTypeString("(x) &&"),
          fromKeys("escape"),
        ],
      },
      {
        description: "Paste object literal and delete ``Object.assign'' call.",
        eventCreators: [fromKeys("( p ) k ctrl-shift-l d { s alt-l")],
      },
    ],
  },
  {
    nameParts: ["wrap-handlers"],
    describedGroups: [
      {
        description:
          "Select all properties and split cursor (cursor per property)",
        eventCreators: [fromKeys("{ s")],
      },
      {
        description: "Select, copy and delete property value.",
        eventCreators: [fromKeys("alt-l c d")],
      },
      {
        description:
          "Add call to ``warnOnError'' and paste old property value inside.",
        eventCreators: [
          fromKeys("a"),
          toTypeString("warnOnError(x)"),
          fromKeys("escape ( p"),
        ],
      },
      {
        description:
          "Remove all cursors except the last and add a new property.",
        eventCreators: [
          fromKeys("shift-s l shift-h k a"),
          toTypeString(',"ctrl-x": ignoreError(cut)'),
          fromKeys("escape"),
        ],
      },
      {
        description: "Delete the loop that would wrap each property.",
        eventCreators: [fromKeys("} shift-l space d")],
      },
    ],
  },
];
