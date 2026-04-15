export * from "./rpc";
export * from "./fs";

export type ProcessState = "idle" | "starting" | "running" | "stopping" | "error";

export type AgentStatus = "idle" | "thinking" | "compacting" | "retrying" | "error";

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
}

export interface QueueInfo {
  steering: string[];
  followUp: string[];
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "complete" | "error";
  partialResult?: string;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  thinkingContent?: string;
  isThinkingVisible?: boolean;
  toolCalls?: ToolExecution[];
  attachedFiles?: AttachedFile[];
  model?: string;
}

export interface AttachedFile {
  name: string;
  path: string;
  content: string;
  size: number;
  language?: string;
}

export interface AppSettings {
  binaryPath?: string;
  extraCliArgs?: string;
  autoReattach: boolean;
  showGitignored: boolean;
  fileSizeLimit: number;
  theme: "dark" | "light";
  fontSize: number;
  logLevel: "debug" | "info" | "warn" | "error";
  maxRetries: number;
  toolApprovalGate: boolean;
  activityLog: boolean;
  gitCheckpoint: boolean;
  lastAttachedFolder?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  toolName: string;
  args: string;
  exitCode?: number;
  duration?: number;
  status: "started" | "completed" | "error";
}

export interface SessionListItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  attachedFolder?: string;
  messageCount: number;
}
