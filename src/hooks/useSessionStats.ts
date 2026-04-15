import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";

export function useSessionStats() {
  const isConnected = useStore((s) => s.isConnected);

  useEffect(() => {
    if (!isConnected) return;

    const poll = setInterval(async () => {
      try {
        await invoke("pi_command", {
          cmd: { type: "get_session_stats" },
        });
      } catch {
        // ignore polling errors
      }
    }, 10_000);

    return () => clearInterval(poll);
  }, [isConnected]);
}
