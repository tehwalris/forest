// src/logic/tree/base-nodes/list.ts

export function getChildShortcuts() {
  const shortcuts = new Map<string, string[]>();
  for (const [i, { key }] of this.children.slice(0, 9).entries()) {
    shortcuts.set(`${i + 1}`, [key]);
  }
  return shortcuts;
}
