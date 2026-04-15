import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { ExtensionUIRequest, ExtensionUIResponse } from "@/types";

interface PendingRequest {
  id: string;
  method: string;
  title: string;
  options?: string[];
  message?: string;
  placeholder?: string;
  resolve: (response: ExtensionUIResponse) => void;
}

const pendingRequests = new Map<string, PendingRequest>();

export function useExtensionUI() {
  useEffect(() => {
    const unlisten = listen<ExtensionUIRequest>("pi:event", (e) => {
      const event = e.payload;
      if (event.type !== "extension_ui_request") return;

      switch (event.method) {
        case "select":
          handleSelect(event);
          break;
        case "confirm":
          handleConfirm(event);
          break;
        case "input":
          handleInput(event);
          break;
        case "notify":
          handleNotify(event);
          break;
        case "setStatus":
        case "setWidget":
        case "setTitle":
        case "set_editor_text":
          // Fire-and-forget — no response needed
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}

async function sendUIResponse(response: ExtensionUIResponse) {
  try {
    await invoke("pi_command", { cmd: response });
  } catch (err) {
    console.error("Failed to send extension UI response:", err);
  }
}

function handleSelect(event: Extract<ExtensionUIRequest, { method: "select" }>) {
  // Simple prompt-based select for now — in production, show a modal
  const options = event.options;
  const choice = options[0]; // Default to first option
  // TODO: Show proper modal with options
  sendUIResponse({
    type: "extension_ui_response",
    id: event.id,
    value: choice,
  });
}

function handleConfirm(event: Extract<ExtensionUIRequest, { method: "confirm" }>) {
  // Auto-confirm for now — in production, show a confirm dialog
  // TODO: Show proper confirm dialog
  sendUIResponse({
    type: "extension_ui_response",
    id: event.id,
    confirmed: true,
  });
}

function handleInput(event: Extract<ExtensionUIRequest, { method: "input" }>) {
  // Check if the title contains a URL — if so, open in system browser
  if (event.title.includes("https://")) {
    const urlMatch = event.title.match(/(https:\/\/[^\s]+)/);
    if (urlMatch) {
      // Open URL in system browser via Tauri shell
      invoke("plugin:shell|open", { path: urlMatch[1] }).catch(() => {});
    }
  }

  // TODO: Show proper input dialog
  // For now, prompt with a simple window.prompt
  const value = window.prompt(event.title, event.placeholder ?? "");
  if (value !== null) {
    sendUIResponse({
      type: "extension_ui_response",
      id: event.id,
      value,
    });
  } else {
    sendUIResponse({
      type: "extension_ui_response",
      id: event.id,
      cancelled: true,
    });
  }
}

function handleNotify(event: Extract<ExtensionUIRequest, { method: "notify" }>) {
  // Show as console log for now — in production, use toast
  const level = event.notifyType ?? "info";
  if (level === "error") {
    console.error("[extension]", event.message);
  } else if (level === "warning") {
    console.warn("[extension]", event.message);
  } else {
    console.info("[extension]", event.message);
  }
}
