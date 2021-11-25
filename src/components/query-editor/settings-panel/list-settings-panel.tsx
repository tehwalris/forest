import { ListSearchSettings } from "../../../logic/search/interfaces";

interface Props {
  settings: ListSearchSettings;
  setSettings: (settings: ListSearchSettings) => void;
}

export const ListSettingsPanel = ({ settings, setSettings }: Props) => {
  return <div>{JSON.stringify(settings)}</div>;
};
