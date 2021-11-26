import { Cursor } from "./interfaces";
export function adjustPostActionCursor(
  oldCursor: Cursor,
  overwrite: Partial<Cursor>,
  newParent: Cursor | undefined,
): Cursor {
  return {
    ...oldCursor,
    enableReduceToTip: false,
    parentPath: newParent
      ? [...oldCursor.parentPath, newParent.id]
      : oldCursor.parentPath,
    id: newParent ? Symbol() : oldCursor.id,
    ...overwrite,
  };
}
