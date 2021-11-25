import { useMemo } from "react";
import ts from "typescript";
import {
  normalizeFocusInOnce,
  normalizeFocusOut,
  whileUnevenFocusChanges,
} from "../../logic/focus";
import {
  EvenPathRange,
  ListKind,
  NodeKind,
  NodeWithPath,
} from "../../logic/interfaces";
import {
  asEvenPathRange,
  asUnevenPathRange,
  uniqueByPath,
} from "../../logic/path-utils";
import { nodeGetByPath } from "../../logic/tree-utils/access";
import { SelectTargetExactState, State } from "./interfaces";

interface Props {
  state: SelectTargetExactState;
  setState: (state: State) => void;
}

export const SelectTargetExactEditor = ({
  state: { doc, roughTarget },
  setState,
}: Props) => {
  const equivalentNodes: NodeWithPath[] = useMemo(() => {
    const equivalentFocuses: EvenPathRange[] = [];
    whileUnevenFocusChanges(
      asUnevenPathRange(
        normalizeFocusOut(doc.root, { anchor: roughTarget, offset: 0 }),
      ),
      (focus) => normalizeFocusInOnce(doc.root, focus),
      (focus) => equivalentFocuses.push(asEvenPathRange(focus)),
    );
    const equivalentPaths = uniqueByPath(
      equivalentFocuses.filter((f) => !f.offset).map((f) => f.anchor),
      (v) => v,
    );
    if (!equivalentPaths.length) {
      throw new Error("unreachable");
    }
    return equivalentPaths.map((path) => {
      const node = nodeGetByPath(doc.root, path);
      if (!node) {
        throw new Error("invalid path");
      }
      return { node, path };
    });
  }, [doc, roughTarget]);
  return (
    <ul>
      {equivalentNodes.map(({ node, path }, i) => (
        <li key={i}>
          {[
            ["path", JSON.stringify(path)],
            ["node.kind", NodeKind[node.kind]],
            [
              "node.listKind",
              node.kind === NodeKind.List ? ListKind[node.listKind] : "-",
            ],
            [
              "node.tsNode.kind",
              node.tsNode ? ts.SyntaxKind[node.tsNode.kind] : "-",
            ],
          ]
            .map((v) => v.join(": "))
            .join(", ")}
        </li>
      ))}
    </ul>
  );
};
