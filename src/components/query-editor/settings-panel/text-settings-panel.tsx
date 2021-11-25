import { TextSearchSettings } from "../../../logic/search/interfaces";

interface Props {
  settings: TextSearchSettings;
  setSettings: (settings: TextSearchSettings) => void;
}

export const TextSettingsPanel = ({ settings, setSettings }: Props) => {
  return (
    <div>
      <label>
        Match text{" "}
        <select
          value={
            settings.exactMatch
              ? "exact"
              : settings.satisfyingExpression !== undefined
              ? "expression"
              : "ignore"
          }
          onChange={(ev) =>
            setSettings({
              ...settings,
              ...(ev.target.value === "exact"
                ? { exactMatch: true, satisfyingExpression: undefined }
                : {}),
              ...(ev.target.value === "expression"
                ? {
                    exactMatch: false,
                    satisfyingExpression: settings.satisfyingExpression || "",
                  }
                : {}),
              ...(ev.target.value === "ignore"
                ? { exactMatch: false, satisfyingExpression: undefined }
                : {}),
            })
          }
        >
          <option value="exact">Exact</option>
          <option value="expression">Satisfying expression</option>
          <option value="ignore">Ignore</option>
        </select>
      </label>
      {settings.satisfyingExpression !== undefined && (
        <label>
          Expression{" "}
          <input
            type="text"
            value={settings.satisfyingExpression}
            onChange={(ev) =>
              setSettings({
                ...settings,
                satisfyingExpression: ev.target.value,
              })
            }
            placeholder="Example: s.match(/^[a-z]+$/)"
          />
        </label>
      )}
    </div>
  );
};
