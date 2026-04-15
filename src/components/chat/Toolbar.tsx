import { useStore } from "@/store";
import { Settings, PanelLeft, PanelRight, RotateCcw } from "lucide-react";
import { ModelPicker } from "./ModelPicker";

export function Toolbar() {
  const agentStatus = useStore((s) => s.agentStatus);
  const processState = useStore((s) => s.processState);
  const sessionStats = useStore((s) => s.sessionStats);
  const retryInfo = useStore((s) => s.retryInfo);
  const queueInfo = useStore((s) => s.queueInfo);
  const panelCollapsed = useStore((s) => s.panelCollapsed);
  const rightPanelOpen = useStore((s) => s.rightPanelOpen);
  const sessionState = useStore((s) => s.sessionState);

  const pendingCount =
    queueInfo.steering.length + queueInfo.followUp.length;

  const contextPercent = sessionStats?.contextUsage?.percent;

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => useStore.getState().togglePanelCollapsed()}
          className="text-zinc-500 hover:text-zinc-300"
          title="Toggle file panel (⌘B)"
        >
          <PanelLeft size={16} />
        </button>

        <StatusPill
          status={agentStatus}
          processState={processState}
          retryInfo={retryInfo}
        />

        {pendingCount > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ModelPicker />

        {contextPercent != null && (
          <span className="text-xs text-zinc-500">
            {Math.round(contextPercent)}% ctx
          </span>
        )}

        <button
          onClick={() => useStore.getState().toggleRightPanel()}
          className={`${rightPanelOpen ? "text-zinc-300" : "text-zinc-500"} hover:text-zinc-300`}
          title="Toggle activity panel (⌘K)"
        >
          <PanelRight size={16} />
        </button>

        <button
          onClick={() => useStore.getState().setSettingsOpen(true)}
          className="text-zinc-500 hover:text-zinc-300"
          title="Settings (⌘,)"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  processState,
  retryInfo,
}: {
  status: string;
  processState: string;
  retryInfo: { attempt: number; maxAttempts: number; delayMs: number } | null;
}) {
  if (processState === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] font-medium text-red-400">
        <RotateCcw size={10} />
        Error
      </span>
    );
  }

  if (processState === "starting") {
    return (
      <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
        Starting...
      </span>
    );
  }

  if (status === "compacting") {
    return (
      <span className="rounded-full bg-purple-900/50 px-2 py-0.5 text-[10px] font-medium text-purple-400 animate-pulse">
        Compacting...
      </span>
    );
  }

  if (status === "retrying" && retryInfo) {
    return (
      <span className="rounded-full bg-orange-900/50 px-2 py-0.5 text-[10px] font-medium text-orange-400">
        Retry {retryInfo.attempt}/{retryInfo.maxAttempts}
      </span>
    );
  }

  if (status === "thinking") {
    return (
      <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-400 animate-pulse">
        Thinking...
      </span>
    );
  }

  return (
    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
      Idle
    </span>
  );
}
