import { useStore } from "@/store";

export function GeneralTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <div className="space-y-4">
      <SettingField label="Binary Path">
        <input
          type="text"
          value={settings.binaryPath ?? ""}
          onChange={(e) =>
            updateSettings({
              binaryPath: e.target.value || undefined,
            })
          }
          placeholder="pi (uses PATH)"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
        />
      </SettingField>

      <SettingField label="Extra CLI Args">
        <input
          type="text"
          value={settings.extraCliArgs ?? ""}
          onChange={(e) =>
            updateSettings({
              extraCliArgs: e.target.value || undefined,
            })
          }
          placeholder="--provider anthropic"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
        />
      </SettingField>

      <SettingField label="Auto-reattach last folder">
        <Toggle
          checked={settings.autoReattach}
          onChange={(v) => updateSettings({ autoReattach: v })}
        />
      </SettingField>

      <SettingField label="Show gitignored files">
        <Toggle
          checked={settings.showGitignored}
          onChange={(v) => updateSettings({ showGitignored: v })}
        />
      </SettingField>

      <SettingField label="File size limit (KB)">
        <input
          type="number"
          value={Math.round(settings.fileSizeLimit / 1024)}
          onChange={(e) =>
            updateSettings({
              fileSizeLimit: Number(e.target.value) * 1024,
            })
          }
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        />
      </SettingField>

      <SettingField label="Font size">
        <input
          type="number"
          value={settings.fontSize}
          onChange={(e) =>
            updateSettings({ fontSize: Number(e.target.value) })
          }
          min={10}
          max={24}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        />
      </SettingField>

      <SettingField label="Max retries">
        <input
          type="number"
          value={settings.maxRetries}
          onChange={(e) =>
            updateSettings({ maxRetries: Number(e.target.value) })
          }
          min={0}
          max={10}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500"
        />
      </SettingField>
    </div>
  );
}

function SettingField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? "bg-blue-600" : "bg-zinc-700"
      }`}
    >
      <div
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
