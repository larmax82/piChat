import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import type { RpcEvent, RpcResponse, SessionStats } from "@/types";

let currentMessageId: string | null = null;

function handleEvent(event: RpcEvent) {
  const store = useStore.getState();

  switch (event.type) {
    case "agent_start": {
      store.setAgentStatus("thinking");
      currentMessageId = crypto.randomUUID();
      store.addMessage({
        id: currentMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
        toolCalls: [],
      });
      break;
    }

    case "agent_end": {
      store.setAgentStatus("idle");
      if (currentMessageId) {
        store.updateMessage(currentMessageId, { isStreaming: false });
        currentMessageId = null;
      }
      break;
    }

    case "message_update": {
      if (!currentMessageId) break;
      const me = event.assistantMessageEvent;
      switch (me.type) {
        case "text_delta":
          store.appendToMessage(currentMessageId, me.delta ?? "");
          break;
        case "thinking_delta":
          store.appendThinking(currentMessageId, me.delta ?? "");
          break;
        case "toolcall_start":
          if (me.toolCall) {
            store.addToolCall(currentMessageId, {
              toolCallId: me.toolCall.id,
              toolName: me.toolCall.name,
              args: me.toolCall.arguments,
              status: "pending",
            });
          }
          break;
        case "toolcall_end":
          if (me.toolCall) {
            store.updateToolCall(currentMessageId, me.toolCall.id, {
              args: me.toolCall.arguments,
              status: "pending",
            });
          }
          break;
        case "done":
          store.updateMessage(currentMessageId, { isStreaming: false });
          break;
        case "error":
          store.updateMessage(currentMessageId, { isStreaming: false });
          store.setAgentStatus("error");
          break;
      }
      break;
    }

    case "tool_execution_start": {
      if (!currentMessageId) break;
      store.updateToolCall(currentMessageId, event.toolCallId, {
        status: "running",
        toolName: event.toolName,
        args: event.args,
      });
      if (store.settings.activityLog) {
        store.addActivityEntry({
          id: event.toolCallId,
          timestamp: Date.now(),
          toolName: event.toolName,
          args: JSON.stringify(event.args).slice(0, 200),
          status: "started",
        });
      }
      break;
    }

    case "tool_execution_update": {
      if (!currentMessageId) break;
      const partialText = event.partialResult?.content
        ?.map((c) => c.text)
        .join("");
      store.updateToolCall(currentMessageId, event.toolCallId, {
        partialResult: partialText,
      });
      break;
    }

    case "tool_execution_end": {
      if (!currentMessageId) break;
      const resultText = event.result?.content?.map((c) => c.text).join("");
      store.updateToolCall(currentMessageId, event.toolCallId, {
        status: "complete",
        result: resultText,
        isError: event.isError,
      });
      if (store.settings.activityLog) {
        store.updateActivityEntry(event.toolCallId, {
          status: event.isError ? "error" : "completed",
          duration: Date.now() - (store.activityLog.find((e) => e.id === event.toolCallId)?.timestamp ?? Date.now()),
        });
      }
      break;
    }

    case "queue_update":
      store.setQueueInfo({
        steering: event.steering,
        followUp: event.followUp,
      });
      break;

    case "compaction_start":
      store.setAgentStatus("compacting");
      break;

    case "compaction_end":
      store.setAgentStatus("idle");
      break;

    case "auto_retry_start":
      store.setAgentStatus("retrying");
      store.setRetryInfo({
        attempt: event.attempt,
        maxAttempts: event.maxAttempts,
        delayMs: event.delayMs,
      });
      break;

    case "auto_retry_end":
      store.setRetryInfo(null);
      if (!event.success) {
        store.setAgentStatus("error");
      }
      break;

    case "extension_error":
      console.error("Extension error:", event.error);
      break;
  }
}

function handleResponse(response: RpcResponse) {
  const store = useStore.getState();
  if (!response.success) {
    console.error(`RPC error (${response.command}):`, response.error);
    return;
  }

  if (response.command === "get_state" && response.data) {
    store.setSessionState(response.data as import("@/types").RpcSessionState);
  }

  if (response.command === "get_session_stats" && response.data) {
    store.setSessionStats(response.data as SessionStats);
  }

  if (response.command === "get_available_models" && response.data) {
    const d = response.data as { models: import("@/types").Model[] };
    store.setAvailableModels(d.models);
  }
}

export function usePiEvents() {
  const isSetup = useRef(false);

  useEffect(() => {
    if (isSetup.current) return;
    isSetup.current = true;

    const unlisten1 = listen<RpcEvent>("pi:event", (e) => {
      handleEvent(e.payload);
    });

    const unlisten2 = listen<RpcResponse>("pi:response", (e) => {
      handleResponse(e.payload);
    });

    const unlisten3 = listen<string>("pi:process_state", (e) => {
      useStore
        .getState()
        .setProcessState(e.payload as import("@/types").ProcessState);
      if (e.payload === "running") {
        useStore.getState().setIsConnected(true);
      } else if (e.payload === "error" || e.payload === "idle") {
        useStore.getState().setIsConnected(false);
      }
    });

    return () => {
      unlisten1.then((fn) => fn());
      unlisten2.then((fn) => fn());
      unlisten3.then((fn) => fn());
    };
  }, []);
}
