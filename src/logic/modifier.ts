export function isModifierKey(key: string): boolean {
  return !!key.match(/^modifiers\[(\d+)\]$/);
}
