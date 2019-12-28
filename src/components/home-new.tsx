import * as React from "react";
import { EmptyLeafNode } from "../logic/tree/base-nodes";
import { Node } from "../logic/tree/node";
import { useMemo, useState, useEffect } from "react";
import {
  buildNodeIndex,
  buildDivetreeDisplayTree,
  buildDivetreeNavTree,
  buildParentIndex,
} from "../logic/tree/display-new";
import { NavTree } from "divetree-react";
import TypescriptProvider from "../logic/providers/typescript";
import { NodeContent } from "./tree/node-content";

const TYPESCRIPT_PROVIDER = new TypescriptProvider();
const INITIAL_FILE: string = "temp/fizz-buzz/index.ts";

export const HomeNew: React.FC<{}> = () => {
  const [tree, setTree] = useState<Node<unknown>>(new EmptyLeafNode());

  useEffect(() => {
    const openFile = (filePath: string) =>
      setTree(TYPESCRIPT_PROVIDER.loadTree(filePath));
    (window as any).openFile = openFile;
    openFile(INITIAL_FILE);
  }, []);

  const [focusedId, setFocusedId] = useState(tree.id);

  const { nodesById, parentsById, navTree, displayTree } = useMemo(() => {
    return {
      nodesById: buildNodeIndex(tree),
      parentsById: buildParentIndex(tree),
      navTree: buildDivetreeNavTree(tree),
      displayTree: buildDivetreeDisplayTree(tree),
    };
  }, [tree]);

  return (
    <NavTree
      navTree={navTree}
      getDisplayTree={focusPath => displayTree}
      getContent={id => (
        <NodeContent id={id} nodesById={nodesById} parentsById={parentsById} />
      )}
      focusedId={focusedId}
      onFocusedIdChange={setFocusedId}
    />
  );
};
