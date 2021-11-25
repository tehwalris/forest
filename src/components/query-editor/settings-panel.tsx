import ts from "typescript";
import { ListKind, Node, NodeKind } from "../../logic/interfaces";
import { StructuralSearchSettings } from "../../logic/search/interfaces";

interface Props {
  node: Node;
  settings: StructuralSearchSettings;
  setSettings: (settings: StructuralSearchSettings) => void;
}

export const SettingsPanel = ({ node, settings, setSettings }: Props) => {
  const nodeDescription = [
    ["node.kind", NodeKind[node.kind]],
    [
      "node.listKind",
      node.kind === NodeKind.List ? ListKind[node.listKind] : "-",
    ],
    ["node.tsNode.kind", node.tsNode ? ts.SyntaxKind[node.tsNode.kind] : "-"],
  ]
    .map((v) => v.join(": "))
    .join(", ");
  return (
    <div>
      <div>{nodeDescription}</div>
      <div>{JSON.stringify(settings)}</div>
    </div>
  );
};
