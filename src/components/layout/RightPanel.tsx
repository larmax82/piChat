import { useStore } from "@/store";
import { X } from "lucide-react";

export function RightPanel() {
  const activityLog = useStore((s) => s.activityLog);
  const setRightPanelOpen = useStore((s) => s.setRightPanelOpen);

  return (
    <div className="flex h-full flex-col border-l border-zinc-700 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2">
        <span className="text-xs font-medium text-zinc-400 uppercase">
          Activity
        </span>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {activityLog.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            No activity yet
          </p>
        ) : (
          <div className="space-y-1">
            {activityLog.map((entry) => (
              <div
                key={entry.id}
                className="rounded border border-zinc-800 px-2 py-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-zinc-300">
                    {entry.toolName}
                  </span>
                  <span className="text-zinc-500">
                    {entry.duration != null ? `${entry.duration}ms` : "..."}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-zinc-500">
                  {entry.args}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
