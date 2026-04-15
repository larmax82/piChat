import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";

export async function newSession() {
  useStore.getState().clearMessages();
  useStore.getState().setCurrentSessionId(crypto.randomUUID());
  try {
    await invoke("pi_command", { cmd: { type: "new_session" } });
  } catch {
    // pi may not be running
  }
}
