import { useStore } from "@/store";

export function HooksTab() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-300">Tool Approval Gate</div>
          <div className="text-xs text-zinc-500">
            Require approval for bash, write, edit tool calls
          </div>
        </div>
        <Toggle
          checked={settings.toolApprovalGate}
          onChange={(v) => updateSettings({ toolApprovalGate: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-300">Activity Log</div>
          <div className="text-xs text-zinc-500">
            Log all tool executions to the right panel
          </div>
        </div>
        <Toggle
          checked={settings.activityLog}
          onChange={(v) => updateSettings({ activityLog: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-300">Git Checkpoint</div>
          <div className="text-xs text-zinc-500">
            Auto-commit after each agent turn
          </div>
        </div>
        <Toggle
          checked={settings.gitCheckpoint}
          onChange={(v) => updateSettings({ gitCheckpoint: v })}
        />
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-300">
          Extension Files
        </h3>
        <p className="text-xs text-zinc-500">
          Global: ~/.pi/agent/extensions/
          <br />
          Project: .pi/extensions/
        </p>
      </div>
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
