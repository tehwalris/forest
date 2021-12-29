export const handlers = {
  "ctrl-v": warnOnError(
    node.actions.setVariant
      ? tryAction("setVariant", (n) => n.id, true)
      : tryAction("setFromString"),
  ),
  "ctrl-d": warnOnError(tryDeleteChild),
  "ctrl-c": warnOnError(() => copyNode(node)),
  "ctrl-p": warnOnError(tryAction("replace", (n) => n.id)),
  "ctrl-f": warnOnError(editFlags),
  "ctrl-4": warnOnError(() =>
    setMarks({ ...marks, TODO: idPathFromParentIndexEntry(parentIndexEntry) }),
  ),
  "ctrl-x": ignoreError(cut),
};
