import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import {
  saveSession,
  loadSession,
  loadSessionList,
  getCurrentSessionId,
} from "@/lib/session-persistence";

export function useSessionPersistence() {
  const messages = useStore((s) => s.messages);
  const currentSessionId = useStore((s) => s.currentSessionId);
  const attachedFolder = useStore((s) => s.attachedFolder);
  const initialized = useRef(false);

  // On mount: restore last session
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const store = useStore.getState();
    const sessions = loadSessionList();
    store.setSessions(sessions);

    const lastId = getCurrentSessionId();
    if (lastId) {
      const session = loadSession(lastId);
      if (session) {
        store.setMessages(session.messages);
        store.setCurrentSessionId(session.id);
      }
    }

    if (!store.currentSessionId) {
      store.setCurrentSessionId(crypto.randomUUID());
    }
  }, []);

  // Auto-save on message changes
  useEffect(() => {
    if (!currentSessionId || messages.length === 0) return;

    const timeout = setTimeout(() => {
      saveSession({
        id: currentSessionId,
        createdAt:
          messages[0]?.timestamp ?? Date.now(),
        updatedAt: Date.now(),
        attachedFolder: attachedFolder ?? undefined,
        messages,
      });

      // Refresh session list in store
      useStore.getState().setSessions(loadSessionList());
    }, 500);

    return () => clearTimeout(timeout);
  }, [messages, currentSessionId, attachedFolder]);
}
