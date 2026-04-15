import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RpcCommand } from "@/types";

export function usePiCommand() {
  return useCallback(async (cmd: RpcCommand) => {
    try {
      await invoke("pi_command", { cmd });
    } catch (err) {
      console.error("Failed to send pi command:", err);
      throw err;
    }
  }, []);
}
