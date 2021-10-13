import { ListNode, Node } from "./interfaces";

export function acceptPasteRoot(clipboard: Node): ListNode | undefined {
  return undefined;
}

export function acceptPasteReplace({
  node,
  firstIndex,
  lastIndex,
  clipboard,
}: {
  node: ListNode;
  firstIndex: number;
  lastIndex: number;
  clipboard: Node;
}): ListNode | undefined {
  if (
    !(
      firstIndex >= 0 &&
      firstIndex <= lastIndex &&
      lastIndex < node.content.length
    )
  ) {
    throw new Error("invalid indices");
  }
  if (firstIndex !== lastIndex) {
    console.warn("TODO pasting over multiple items is not supported yet");
    return undefined;
  }
  // TODO actually check if paste is valid
  const newContent = [...node.content];
  newContent.splice(firstIndex, lastIndex - firstIndex + 1, clipboard);
  return { ...node, content: newContent };
}
