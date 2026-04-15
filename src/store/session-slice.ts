import type { StateCreator } from "zustand";
import type { ChatMessage, ToolExecution, SessionListItem } from "@/types";

export interface SessionSlice {
  messages: ChatMessage[];
  currentSessionId: string | null;
  sessions: SessionListItem[];

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  appendToMessage: (id: string, delta: string) => void;
  appendThinking: (id: string, delta: string) => void;
  addToolCall: (messageId: string, tool: ToolExecution) => void;
  updateToolCall: (messageId: string, toolCallId: string, update: Partial<ToolExecution>) => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: (sessions: SessionListItem[]) => void;
}

export const createSessionSlice: StateCreator<SessionSlice> = (set) => ({
  messages: [],
  currentSessionId: null,
  sessions: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, update) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...update } : m,
      ),
    })),

  appendToMessage: (id, delta) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    })),

  appendThinking: (id, delta) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id
          ? { ...m, thinkingContent: (m.thinkingContent ?? "") + delta }
          : m,
      ),
    })),

  addToolCall: (messageId, tool) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []), tool] }
          : m,
      ),
    })),

  updateToolCall: (messageId, toolCallId, update) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.toolCallId === toolCallId ? { ...tc, ...update } : tc,
              ),
            }
          : m,
      ),
    })),

  clearMessages: () => set({ messages: [] }),
  setMessages: (messages) => set({ messages }),
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
  setSessions: (sessions) => set({ sessions }),
});
