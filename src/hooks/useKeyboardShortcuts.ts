import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { newSession } from "@/lib/session-actions";

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Escape → abort
      if (e.key === "Escape") {
        e.preventDefault();
        invoke("pi_command", { cmd: { type: "abort" } }).catch(() => {});
        return;
      }

      // ⌘B → toggle file panel
      if (mod && e.key === "b") {
        e.preventDefault();
        useStore.getState().togglePanelCollapsed();
        return;
      }

      // ⌘K → toggle right panel
      if (mod && e.key === "k") {
        e.preventDefault();
        useStore.getState().toggleRightPanel();
        return;
      }

      // ⌘N → new session
      if (mod && e.key === "n") {
        e.preventDefault();
        newSession();
        return;
      }

      // ⌘, → settings
      if (mod && e.key === ",") {
        e.preventDefault();
        useStore.getState().setSettingsOpen(true);
        return;
      }

      // ⌘O → open folder
      if (mod && e.key === "o") {
        e.preventDefault();
        invoke("open_folder_dialog").catch(() => {});
        return;
      }

      // ⌘/ → focus chat input
      if (mod && e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLTextAreaElement>(
          'textarea[placeholder*="Send"]',
        );
        el?.focus();
        return;
      }

      // F5 → restart pi
      if (e.key === "F5") {
        e.preventDefault();
        invoke("pi_restart").catch(() => {});
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
