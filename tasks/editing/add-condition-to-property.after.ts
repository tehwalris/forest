var parentIndexEntry: any;
var tryAction: any;
var node: any;
var tryDeleteChild: any;
var copyNode: any;
var copiedNode: any;
var editFlags: any;
var setMarks: any;
var marks: any;
var idPathFromParentIndexEntry: any;

export const handlers: {
  [key: string]: (() => void) | undefined;
} = {
  Enter: node.actions.setVariant
    ? tryAction("setVariant", (n) => n.id, true)
    : tryAction("setFromString"),
  "ctrl-d": tryDeleteChild,
  "ctrl-c": () => copyNode(node),
  "ctrl-p": copiedNode && tryAction("replace", (n) => n.id),
  "ctrl-f": editFlags,
  "ctrl-4": () =>
    setMarks({
      ...marks,
      TODO: idPathFromParentIndexEntry(parentIndexEntry),
    }),
};
