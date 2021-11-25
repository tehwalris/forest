import {
  ListContentMatchKind,
  ListSearchSettings,
} from "../../../logic/search/interfaces";

interface Props {
  settings: ListSearchSettings;
  setSettings: (settings: ListSearchSettings) => void;
}

export const ListSettingsPanel = ({ settings, setSettings }: Props) => {
  return (
    <div>
      <label>
        Match content{" "}
        <select
          value={settings.contentMatch}
          onChange={(ev) =>
            setSettings({
              ...settings,
              contentMatch: ev.target.value as ListContentMatchKind,
            })
          }
        >
          <option value="Whole">Whole</option>
          <option value="Ignore">Ignore</option>
        </select>
      </label>
    </div>
  );
};
