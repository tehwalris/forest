import { Node, DisplayInfo } from "./node";
import { Path } from "./base";
import * as R from "ramda";
export type DisplayPath = number[];
export interface DisplayNode {
  baseNode: Node<{}>;
  basePath: Path;
  displayPath: DisplayPath;
  chain: { key: string; node: Node<{}> }[];
  children: DisplayNode[];
  parent: DisplayNode | undefined;
  bestDisplayInfo?: DisplayInfo;
}
export function buildDisplayTree(
  root: Node<{}>,
  basePath: Path = [],
  displayPath: DisplayPath = [],
  parent?: DisplayNode
): DisplayNode {
  const childChain = R.unfold(
    ({ node, actions, flags }) => {
      const firstChild = node.children[0];
      const childActions = firstChild && Object.keys(firstChild.node.actions);
      const childFlags = firstChild && Object.keys(firstChild.node.flags);
      if (
        node.children.length !== 1 ||
        R.intersection(actions, childActions).length ||
        R.intersection(flags, childFlags).length
      ) {
        return false;
      }
      return [
        firstChild,
        {
          node: firstChild.node,
          actions: [...actions, ...childActions],
          flags: [...flags, childFlags]
        }
      ];
    },
    {
      node: root,
      actions: Object.keys(root.actions),
      flags: Object.keys(root.flags)
    }
  );
  if (childChain.length) {
    const deepChild = childChain[childChain.length - 1].node;
    const self: DisplayNode = {
      baseNode: root,
      basePath,
      displayPath,
      chain: childChain,
      children: [],
      parent
    };
    self.children = deepChild.children.map((e, i) =>
      buildDisplayTree(
        e.node,
        [...basePath, ...childChain.map(c => c.key), e.key],
        [...displayPath, i],
        self
      )
    );
    return withDisplayInfo(self);
  }
  const self: DisplayNode = {
    baseNode: root,
    basePath,
    displayPath,
    chain: [],
    children: [],
    parent
  };
  self.children = root.children.map((e, i) =>
    buildDisplayTree(e.node, [...basePath, e.key], [...displayPath, i], self)
  );
  return withDisplayInfo(self);
}

function withDisplayInfo(original: DisplayNode): DisplayNode {
  const nodes = nodesFromDisplayNode(original);
  const bestDisplayInfo = nodes.reduce((a: DisplayInfo | undefined, _c) => {
    const c = _c.node.getDisplayInfo();
    return !a || (c && c.priority >= a.priority) ? c : a;
  }, undefined);
  return { ...original, bestDisplayInfo };
}

export function nodesFromDisplayNode(
  displayNode: DisplayNode
): Array<{ path: Path; node: Node<any> }> {
  const nodes = [{ path: displayNode.basePath, node: displayNode.baseNode }];
  displayNode.chain.forEach(({ key, node }) =>
    nodes.push({ path: [...R.last(nodes)!.path, key], node })
  );
  return nodes;
}
