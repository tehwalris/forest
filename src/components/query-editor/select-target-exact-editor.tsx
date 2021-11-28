import { last } from "ramda";
import { useMemo, useState } from "react";
import ts from "typescript";
import { getEquivalentNodes } from "../../logic/focus";
import { ListKind, NodeKind, NodeWithPath } from "../../logic/interfaces";
import {
  pathFromString,
  pathsAreEqual,
  stringFromPath,
} from "../../logic/path-utils";
import { SelectTargetExactState, Stage, State } from "./interfaces";

interface Props {
  state: SelectTargetExactState;
  setState: (state: State) => void;
}

export const SelectTargetExactEditor = ({
  state: { doc, roughTarget },
  setState,
}: Props) => {
  const equivalentNodes: NodeWithPath[] = useMemo(
    () => getEquivalentNodes(doc.root, roughTarget),
    [doc, roughTarget],
  );
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
          stage: Stage.Configure,
          doc,
          target: selectedEquivalentNode.path,
          executionSettings: { shallowSearchForRoot: false },
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
