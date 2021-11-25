import { GenericSearchSettings } from "../../../logic/search/interfaces";

interface Props {
  settings: GenericSearchSettings;
  setSettings: (settings: GenericSearchSettings) => void;
}

export const GenericSettingsPanel = ({ settings, setSettings }: Props) => {
  return <div>{JSON.stringify(settings)}</div>;
};
