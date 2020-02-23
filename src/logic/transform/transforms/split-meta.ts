import { Transform } from "..";
import { MetaBranchNode } from "../../providers/typescript/meta";

export const splitMetaTransform: Transform = node => {
  // TODO Properly detect which nodes to split (and how to do it)
  if (node.getDebugLabel() !== "InterfaceDeclaration") {
    return node;
  }

  return MetaBranchNode.fromNode(node, { primaryChildren: ["members"] });
};
