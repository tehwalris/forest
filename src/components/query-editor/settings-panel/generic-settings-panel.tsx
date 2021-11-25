import { GenericSearchSettings } from "../../../logic/search/interfaces";

interface Props {
  settings: GenericSearchSettings;
  setSettings: (settings: GenericSearchSettings) => void;
}

export const GenericSettingsPanel = ({ settings, setSettings }: Props) => {
  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={settings.deep}
          onChange={(ev) =>
            setSettings({ ...settings, deep: ev.target.checked })
          }
        />
        Deep match
      </label>
    </div>
  );
};
