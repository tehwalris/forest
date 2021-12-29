export const handlers = {
  "ctrl-v": node.actions.setVariant
    ? tryAction("setVariant", (n) => n.id, true)
    : tryAction("setFromString"),
  "ctrl-d": tryDeleteChild,
  "ctrl-c": () => copyNode(node),
  "ctrl-p": tryAction("replace", (n) => n.id),
  "ctrl-f": editFlags,
  "ctrl-4": () =>
    setMarks({ ...marks, TODO: idPathFromParentIndexEntry(parentIndexEntry) }),
};
for (const [k, v] of handlers) {
  handlers[k] = warnOnError(v);
}
