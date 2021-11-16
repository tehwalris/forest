import { ListNode, Node } from "./interfaces";
import { isSubarray } from "./util";
export function assertNodeHasValidStructKeys(
  node: ListNode,
): asserts node is ListNode & {
  structKeys: string[];
} {
  if (
    !node.structKeys ||
    node.structKeys.length !== node.content.length ||
    new Set(node.structKeys).size !== node.structKeys.length
  ) {
    throw new Error("structKeys is invalid");
  }
}
export function getStructContent<RK extends string, OK extends string>(
  node: ListNode,
  requiredKeys: RK[],
  optionalKeys: OK[],
): {
  [K in RK]: Node;
} &
  {
    [K in OK]?: Node;
  } {
  assertNodeHasValidStructKeys(node);
  const expectedKeySet = new Set<string>([...requiredKeys, ...optionalKeys]);
  if (expectedKeySet.size !== requiredKeys.length + optionalKeys.length) {
    throw new Error("requiredKeys and optionalKeys contain duplicates");
  }
  if (!node.structKeys.every((k) => expectedKeySet.has(k))) {
    throw new Error("some structKeys are not known");
  }
  const output: {
    [key: string]: Node | undefined;
  } = {};
  for (const k of requiredKeys) {
    const i = node.structKeys.indexOf(k);
    if (i === -1) {
      throw new Error(`required key not found: ${k}`);
    }
    output[k] = node.content[i];
  }
  for (const k of optionalKeys) {
    const i = node.structKeys.indexOf(k);
    if (i !== -1) {
      output[k] = node.content[i];
    }
  }
  return output as any;
}
export interface WithDefaultContentMapArgs {
  oldIndex?: number;
  newIndex: number;
  key: string;
  node: Node;
}
export function withDefaultContent(
  oldNode: ListNode,
  defaultContent: {
    key: string;
    node?: Node;
  }[],
  map: (args: WithDefaultContentMapArgs) => Node,
): ListNode {
  assertNodeHasValidStructKeys(oldNode);
  if (
    !isSubarray(
      defaultContent.map((e) => e.key),
      oldNode.structKeys,
    )
  ) {
    throw new Error(
      "oldNode.structKeys contains keys which are either not in defaultContent or not in the same order",
    );
  }
  const newContent: Node[] = [];
  const newStructKeys: string[] = [];
  const mapAndPush = ({
    key,
    node,
    oldIndex,
  }: {
    key: string;
    node: Node;
    oldIndex?: number;
  }) => {
    const mappedNode = map({
      oldIndex,
      newIndex: newContent.length,
      key,
      node,
    });
    newContent.push(mappedNode);
    newStructKeys.push(key);
  };
  let oldIndex = 0;
  for (const defaultEntry of defaultContent) {
    if (
      oldIndex < oldNode.structKeys.length &&
      oldNode.structKeys[oldIndex] === defaultEntry.key
    ) {
      mapAndPush({
        key: oldNode.structKeys[oldIndex],
        node: oldNode.content[oldIndex],
        oldIndex,
      });
      oldIndex++;
    } else if (defaultEntry.node) {
      mapAndPush({ key: defaultEntry.key, node: defaultEntry.node });
    }
  }
  if (oldIndex !== oldNode.structKeys.length) {
    throw new Error("unreachable");
  }
  return { ...oldNode, content: newContent, structKeys: newStructKeys };
}
