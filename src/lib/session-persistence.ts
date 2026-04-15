import type { ChatMessage, SessionListItem } from "@/types";

const SESSION_LIST_KEY = "piChat:sessions";
const CURRENT_SESSION_KEY = "piChat:currentSession";

interface StoredSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  attachedFolder?: string;
  messages: ChatMessage[];
}

export function saveSession(session: StoredSession): void {
  try {
    const key = `piChat:session:${session.id}`;
    localStorage.setItem(key, JSON.stringify(session));

    // Update session list
    const list = loadSessionList();
    const existing = list.findIndex((s) => s.id === session.id);
    const item: SessionListItem = {
      id: session.id,
      title: getSessionTitle(session.messages),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      attachedFolder: session.attachedFolder,
      messageCount: session.messages.length,
    };

    if (existing >= 0) {
      list[existing] = item;
    } else {
      list.unshift(item);
    }

    // Keep only 20 most recent
    const trimmed = list
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(trimmed));
    localStorage.setItem(CURRENT_SESSION_KEY, session.id);
  } catch {
    // localStorage might be full
  }
}

export function loadSession(id: string): StoredSession | null {
  try {
    const data = localStorage.getItem(`piChat:session:${id}`);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return null;
}

export function loadSessionList(): SessionListItem[] {
  try {
    const data = localStorage.getItem(SESSION_LIST_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return [];
}

export function getCurrentSessionId(): string | null {
  return localStorage.getItem(CURRENT_SESSION_KEY);
}

export function deleteSession(id: string): void {
  try {
    localStorage.removeItem(`piChat:session:${id}`);
    const list = loadSessionList().filter((s) => s.id !== id);
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function getSessionTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (first) {
    return first.content.slice(0, 50) + (first.content.length > 50 ? "..." : "");
  }
  return "New Session";
}

export function exportAsMarkdown(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "**User**" : "**Assistant**";
      return `${role}\n\n${m.content}\n`;
    })
    .join("\n---\n\n");
}

export function exportAsJson(messages: ChatMessage[]): string {
  return JSON.stringify(messages, null, 2);
}
