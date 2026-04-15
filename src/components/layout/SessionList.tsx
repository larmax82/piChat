import { useStore } from "@/store";
import { loadSession } from "@/lib/session-persistence";
import { invoke } from "@tauri-apps/api/core";
import { MessageSquare, Plus } from "lucide-react";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SessionList() {
  const sessions = useStore((s) => s.sessions);
  const currentSessionId = useStore((s) => s.currentSessionId);

  const handleNewSession = async () => {
    const store = useStore.getState();
    store.clearMessages();
    store.setCurrentSessionId(crypto.randomUUID());
    try {
      await invoke("pi_command", { cmd: { type: "new_session" } });
    } catch {
      // pi may not be running
    }
  };

  const handleSelectSession = (id: string) => {
    if (id === currentSessionId) return;
    const session = loadSession(id);
    if (!session) return;
    const store = useStore.getState();
    store.setMessages(session.messages);
    store.setCurrentSessionId(session.id);
  };

  return (
    <div className="border-t border-zinc-700 bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-medium text-zinc-500 uppercase">
          Sessions
        </span>
        <button
          onClick={handleNewSession}
          className="text-zinc-500 hover:text-zinc-300"
          title="New session (⌘N)"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {sessions.slice(0, 20).map((s) => (
          <button
            key={s.id}
            onClick={() => handleSelectSession(s.id)}
            className={`flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs hover:bg-zinc-800 ${
              s.id === currentSessionId
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500"
            }`}
          >
            <MessageSquare size={10} className="shrink-0" />
            <span className="flex-1 truncate">{s.title}</span>
            <span className="shrink-0 text-[10px] text-zinc-600">
              {timeAgo(s.updatedAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
