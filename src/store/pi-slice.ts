import type { StateCreator } from "zustand";
import type {
  ProcessState,
  AgentStatus,
  RetryInfo,
  QueueInfo,
  Model,
  RpcSessionState,
  SessionStats,
} from "@/types";

export interface PiSlice {
  processState: ProcessState;
  agentStatus: AgentStatus;
  retryInfo: RetryInfo | null;
  queueInfo: QueueInfo;
  sessionState: RpcSessionState | null;
  sessionStats: SessionStats | null;
  availableModels: Model[];
  isConnected: boolean;

  setProcessState: (state: ProcessState) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setRetryInfo: (info: RetryInfo | null) => void;
  setQueueInfo: (info: QueueInfo) => void;
  setSessionState: (state: RpcSessionState | null) => void;
  setSessionStats: (stats: SessionStats | null) => void;
  setAvailableModels: (models: Model[]) => void;
  setIsConnected: (connected: boolean) => void;
}

export const createPiSlice: StateCreator<PiSlice> = (set) => ({
  processState: "idle",
  agentStatus: "idle",
  retryInfo: null,
  queueInfo: { steering: [], followUp: [] },
  sessionState: null,
  sessionStats: null,
  availableModels: [],
  isConnected: false,

  setProcessState: (processState) => set({ processState }),
  setAgentStatus: (agentStatus) => set({ agentStatus }),
  setRetryInfo: (retryInfo) => set({ retryInfo }),
  setQueueInfo: (queueInfo) => set({ queueInfo }),
  setSessionState: (sessionState) => set({ sessionState }),
  setSessionStats: (sessionStats) => set({ sessionStats }),
  setAvailableModels: (availableModels) => set({ availableModels }),
  setIsConnected: (isConnected) => set({ isConnected }),
});
