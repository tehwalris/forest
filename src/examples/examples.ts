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
        description: "insert at start of function body",
        eventCreators: [
          fromKeys("{ i"),
          toTypeString("if(debug){console.log({})}"),
          fromKeys("escape"),
        ],
      },
      {
        description: "select and mark empty object literal",
        eventCreators: [fromKeys("{ { } m a")],
      },
      {
        description: "append function parameter",
        eventCreators: [
          fromKeys("} } shift-h space j a"),
          toTypeString(",debug:boolean=false"),
          fromKeys("escape"),
        ],
      },
      {
        description: "select parameters except debug and split cursor",
        eventCreators: [fromKeys("k ctrl-shift-h s")],
      },
      {
        description: "mark parameter and copy parameter name",
        eventCreators: [fromKeys("m b alt-h c")],
      },
      {
        description: "insert inside marked empty object literal",
        eventCreators: [
          fromKeys("shift-m a j a"),
          toTypeString("x: {current: x, default: x},"),
          fromKeys("escape"),
        ],
      },
      {
        description: 'paste name over first two "x"s',
        eventCreators: [fromKeys("alt-h p l l p")],
      },
      {
        description: 'move to last "x" and mark it',
        eventCreators: [fromKeys("l l m c")],
      },
      {
        description:
          "jump to marked parameter declaration and copy initializer",
        eventCreators: [fromKeys("shift-m b alt-l c")],
      },
      {
        description: 'jump to last "x" and paste initializer',
        eventCreators: [fromKeys("shift-m c p")],
      },
    ],
  },
];
