// src/logic/tree/display-new.ts

var parentEntry, childKey: any;

export const childShortcut = [
  ...parentEntry.parent.getChildShortcuts().entries(),
].find(([k, p]) => p.length === 1 && p[0] === childKey)?.[0];
