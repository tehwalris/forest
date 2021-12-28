import {
  EventCreatorFromKeys,
  EventCreatorKind,
  EventCreatorToTypeString,
  Example,
} from "./interfaces";

function fromKeys(keys: string): EventCreatorFromKeys {
  return { kind: EventCreatorKind.FromKeys, keys };
}

function toTypeString(string: string): EventCreatorToTypeString {
  return { kind: EventCreatorKind.ToTypeString, string };
}

export const examples: Example[] = [
  {
    name: "multi-cursor-marks",
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
    name: "multi-cursor-reduce-across",
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
];
