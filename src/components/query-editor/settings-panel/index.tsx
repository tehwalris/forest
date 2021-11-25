import ts from "typescript";
import { ListKind, Node, NodeKind } from "../../../logic/interfaces";
import {
  SearchSettings,
  SearchSettingsKind,
} from "../../../logic/search/interfaces";
import { unreachable } from "../../../logic/util";
import { GenericSettingsPanel } from "./generic-settings-panel";
import { ListSettingsPanel } from "./list-settings-panel";
import { TextSettingsPanel } from "./text-settings-panel";

interface Props {
  node: Node;
  settings: SearchSettings;
  setSettings: (settings: SearchSettings) => void;
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
  const innerElement = ((): JSX.Element => {
    switch (settings.kind) {
      case SearchSettingsKind.Generic:
        return (
          <GenericSettingsPanel settings={settings} setSettings={setSettings} />
        );
      case SearchSettingsKind.List:
        return (
          <ListSettingsPanel settings={settings} setSettings={setSettings} />
        );
      case SearchSettingsKind.Text:
        return (
          <TextSettingsPanel settings={settings} setSettings={setSettings} />
        );
      default:
        return unreachable(settings);
    }
  })();
  return (
    <div>
      <div>{nodeDescription}</div>
      <div>{innerElement}</div>
    </div>
  );
};
