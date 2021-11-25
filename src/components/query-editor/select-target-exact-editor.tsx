import { last } from "ramda";
import { useMemo, useState } from "react";
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
  pathFromString,
  pathsAreEqual,
  stringFromPath,
  uniqueByPath,
} from "../../logic/path-utils";
import { makeExactMatchQuery } from "../../logic/search/exact";
import { nodeGetByPath } from "../../logic/tree-utils/access";
import { SelectTargetExactState, Stage, State } from "./interfaces";

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
  const [_selectedPathString, setSelectedPathString] = useState<string>();
  const _selectedPath =
    _selectedPathString === undefined
      ? undefined
      : pathFromString(_selectedPathString);
  const selectedEquivalentNode: NodeWithPath | undefined =
    (_selectedPath &&
      equivalentNodes.find((e) => pathsAreEqual(e.path, _selectedPath))) ||
    last(equivalentNodes);
  if (!selectedEquivalentNode) {
    throw new Error("expected at least one choice");
  }
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        setState({
          stage: Stage.QueryReady,
          query: makeExactMatchQuery(selectedEquivalentNode.node),
        });
      }}
    >
      <select
        value={stringFromPath(selectedEquivalentNode.path)}
        onChange={(ev) => setSelectedPathString(ev.target.value)}
      >
        {equivalentNodes.map(({ node, path }) => (
          <option key={stringFromPath(path)} value={stringFromPath(path)}>
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
          </option>
        ))}
      </select>
      <button autoFocus>Select</button>
    </form>
  );
};
